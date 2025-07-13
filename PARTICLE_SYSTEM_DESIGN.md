# Particle System Design

A semantic indexing and @mention system for the Transform Jsondoc Framework, enabling intelligent context construction and enhanced AI agent interactions through particle-based content retrieval.

## Overview

The Particle System provides semantic indexing of jsondoc content fragments (particles) with pgvector-based similarity search, enabling powerful @mention functionality in chat interfaces and intelligent context construction for AI agents.

**Key Features**:
- **Semantic Indexing** - Automatic particle extraction and embedding generation
- **@Mention Integration** - Ant Design Mentions component with fuzzy + semantic search
- **Context Construction** - Enhanced AI agent context with relevant particle retrieval
- **Real-time Updates** - PostgreSQL triggers with event bus for instant particle synchronization
- **Lineage-Aware** - Only active (leaf) jsondocs generate @mention-able particles
- **Chinese-Optimized** - Qwen/DeepSeek embeddings for Chinese content understanding

## Architecture Overview

### **Real-time Update Strategy**

Since Electric SQL doesn't support backend subscriptions, we use **PostgreSQL triggers + Event Bus**:

```sql
-- Trigger function to notify particle updates
CREATE OR REPLACE FUNCTION notify_jsondoc_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify the application about jsondoc changes
    PERFORM pg_notify('jsondoc_changed', 
        json_build_object(
            'jsondoc_id', COALESCE(NEW.id, OLD.id),
            'project_id', COALESCE(NEW.project_id, OLD.project_id),
            'operation', TG_OP,
            'timestamp', extract(epoch from now())
        )::text
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to jsondocs table
CREATE TRIGGER jsondoc_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON jsondocs
    FOR EACH ROW EXECUTE FUNCTION notify_jsondoc_change();
```

### **Event Bus Architecture**

```typescript
// Event bus for real-time particle updates
class ParticleEventBus extends EventEmitter {
    private dbConnection: any;
    private particleService: ParticleService;
    
    constructor(db: any, particleService: ParticleService) {
        super();
        this.dbConnection = db;
        this.particleService = particleService;
        this.setupDatabaseListener();
    }
    
    private async setupDatabaseListener() {
        // Listen for PostgreSQL notifications
        await this.dbConnection.listen('jsondoc_changed', (payload: string) => {
            const data = JSON.parse(payload);
            this.handleJsondocChange(data);
        });
    }
    
    private async handleJsondocChange(data: any) {
        const { jsondoc_id, project_id, operation } = data;
        
        // Debounce rapid changes
        this.debouncedParticleUpdate(jsondoc_id, project_id, operation);
    }
    
    private debouncedParticleUpdate = debounce(async (
        jsondocId: string, 
        projectId: string, 
        operation: string
    ) => {
        try {
            if (operation === 'DELETE') {
                await this.particleService.deleteParticlesByJsondoc(jsondocId);
            } else {
                await this.particleService.updateParticlesForJsondoc(jsondocId, projectId);
            }
            
            // Emit event for any listeners
            this.emit('particles_updated', { jsondocId, projectId, operation });
        } catch (error) {
            console.error('Failed to update particles:', error);
        }
    }, 2000); // 2-second debounce
}
```

## Implementation Plan

### **Phase 1: Core Infrastructure**

#### 1. **Database Schema**
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Particle storage with pgvector
CREATE TABLE particles (
    id TEXT PRIMARY KEY,
    jsondoc_id TEXT NOT NULL REFERENCES jsondocs(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL,
    path TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content JSONB NOT NULL,
    content_text TEXT NOT NULL,
    embedding VECTOR(1536), -- Qwen embedding dimensions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_particles_project_active ON particles(project_id, is_active);
CREATE INDEX idx_particles_jsondoc ON particles(jsondoc_id);
CREATE INDEX idx_particles_type ON particles(type);
CREATE INDEX idx_particles_embedding ON particles USING ivfflat (embedding vector_cosine_ops);

-- Trigger for particle updates
CREATE TRIGGER particles_updated_at_trigger
    BEFORE UPDATE ON particles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2. **Particle Service**
```typescript
// Core particle management service
export class ParticleService {
    constructor(
        private db: Kysely<DB>,
        private embeddingService: EmbeddingService,
        private particleExtractor: ParticleExtractor
    ) {}
    
    async updateParticlesForJsondoc(jsondocId: string, projectId: string): Promise<void> {
        const jsondoc = await this.getJsondoc(jsondocId);
        if (!jsondoc) return;
        
        // Check if jsondoc is active (leaf in lineage)
        const isActive = await this.isJsondocActive(jsondocId);
        
        // Extract particles from jsondoc
        const particles = await this.particleExtractor.extractParticles(jsondoc);
        
        // Update database
        await this.db.transaction(async (tx) => {
            // Delete existing particles
            await tx.deleteFrom('particles')
                .where('jsondoc_id', '=', jsondocId)
                .execute();
            
            if (isActive && particles.length > 0) {
                // Insert new particles
                await tx.insertInto('particles')
                    .values(particles.map(p => ({
                        ...p,
                        jsondoc_id: jsondocId,
                        project_id: projectId,
                        is_active: true
                    })))
                    .execute();
            }
        });
    }
    
    async searchParticles(
        query: string, 
        projectId: string, 
        limit: number = 10
    ): Promise<ParticleSearchResult[]> {
        const embedding = await this.embeddingService.generateEmbedding(query);
        
        const results = await this.db
            .selectFrom('particles')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('is_active', '=', true)
            .orderBy(sql`embedding <-> ${embedding}`)
            .limit(limit)
            .execute();
        
        return results.map(this.formatSearchResult);
    }
    
    private async isJsondocActive(jsondocId: string): Promise<boolean> {
        // Check if jsondoc is a leaf in the lineage (no dependents)
        const dependents = await this.db
            .selectFrom('transform_inputs')
            .select('id')
            .where('jsondoc_id', '=', jsondocId)
            .limit(1)
            .execute();
        
        return dependents.length === 0;
    }
}
```

#### 3. **Particle Extractor**
```typescript
// Extract particles from jsondocs based on schema type
export class ParticleExtractor {
    private extractors: Map<string, ParticleExtractorFunction> = new Map();
    
    constructor(private embeddingService: EmbeddingService) {
        this.registerExtractors();
    }
    
    private registerExtractors() {
        this.extractors.set('brainstorm_collection', this.extractBrainstormParticles);
        this.extractors.set('outline_settings', this.extractOutlineParticles);
        this.extractors.set('chronicles', this.extractChroniclesParticles);
    }
    
    async extractParticles(jsondoc: Jsondoc): Promise<ParticleData[]> {
        const extractor = this.extractors.get(jsondoc.schema_type);
        if (!extractor) return [];
        
        return await extractor.call(this, jsondoc);
    }
    
    private async extractBrainstormParticles(jsondoc: Jsondoc): Promise<ParticleData[]> {
        const data = jsondoc.data;
        const particles: ParticleData[] = [];
        
        if (data.ideas && Array.isArray(data.ideas)) {
            for (let i = 0; i < data.ideas.length; i++) {
                const idea = data.ideas[i];
                const title = idea.title || `创意 ${i + 1}`;
                const content = { title: idea.title, body: idea.body };
                const contentText = `${idea.title}\n${idea.body}`;
                
                particles.push({
                    id: `${jsondoc.id}_idea_${i}`,
                    path: `$.ideas[${i}]`,
                    type: '创意',
                    title,
                    content,
                    content_text: contentText,
                    embedding: await this.embeddingService.generateEmbedding(contentText)
                });
            }
        }
        
        return particles;
    }
    
    private async extractOutlineParticles(jsondoc: Jsondoc): Promise<ParticleData[]> {
        const data = jsondoc.data;
        const particles: ParticleData[] = [];
        
        // Extract characters
        if (data.characters && Array.isArray(data.characters)) {
            for (let i = 0; i < data.characters.length; i++) {
                const character = data.characters[i];
                const title = character.name || `角色 ${i + 1}`;
                const contentText = `${character.name} - ${character.description}`;
                
                particles.push({
                    id: `${jsondoc.id}_character_${i}`,
                    path: `$.characters[${i}]`,
                    type: '人物',
                    title,
                    content: character,
                    content_text: contentText,
                    embedding: await this.embeddingService.generateEmbedding(contentText)
                });
            }
        }
        
        // Extract selling points
        if (data.selling_points && Array.isArray(data.selling_points)) {
            for (let i = 0; i < data.selling_points.length; i++) {
                const point = data.selling_points[i];
                const title = point.length > 20 ? point.substring(0, 20) + '...' : point;
                
                particles.push({
                    id: `${jsondoc.id}_selling_point_${i}`,
                    path: `$.selling_points[${i}]`,
                    type: '卖点',
                    title,
                    content: { text: point },
                    content_text: point,
                    embedding: await this.embeddingService.generateEmbedding(point)
                });
            }
        }
        
        return particles;
    }
    
    private async extractChroniclesParticles(jsondoc: Jsondoc): Promise<ParticleData[]> {
        const data = jsondoc.data;
        const particles: ParticleData[] = [];
        
        if (data.stages && Array.isArray(data.stages)) {
            for (let i = 0; i < data.stages.length; i++) {
                const stage = data.stages[i];
                const title = stage.title || `阶段 ${i + 1}`;
                const contentText = `${stage.title}\n${stage.stageSynopsis}`;
                
                particles.push({
                    id: `${jsondoc.id}_stage_${i}`,
                    path: `$.stages[${i}]`,
                    type: '阶段',
                    title,
                    content: stage,
                    content_text: contentText,
                    embedding: await this.embeddingService.generateEmbedding(contentText)
                });
            }
        }
        
        return particles;
    }
}
```

### **Phase 2: @Mention Integration**

#### 1. **API Endpoints**
```typescript
// Particle search endpoint
router.get('/particles/search', authMiddleware.authenticate, async (req, res) => {
    const { query, projectId, limit = 10 } = req.query;
    const user = authMiddleware.getCurrentUser(req);
    
    // Verify project access
    const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);
    if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const results = await particleService.searchParticles(query, projectId, limit);
    res.json(results);
});
```

#### 2. **React Hook for Particle Search**
```typescript
// Hook for particle search with debouncing
export function useParticleSearch(projectId: string) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ParticleSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    
    const debouncedSearch = useCallback(
        debounce(async (searchQuery: string) => {
            if (!searchQuery.trim()) {
                setResults([]);
                return;
            }
            
            setLoading(true);
            try {
                const response = await fetch(`/api/particles/search?query=${encodeURIComponent(searchQuery)}&projectId=${projectId}`);
                const data = await response.json();
                setResults(data);
            } catch (error) {
                console.error('Particle search failed:', error);
            } finally {
                setLoading(false);
            }
        }, 300),
        [projectId]
    );
    
    useEffect(() => {
        debouncedSearch(query);
    }, [query, debouncedSearch]);
    
    return { query, setQuery, results, loading };
}
```

#### 3. **Ant Design Mentions Component**
```typescript
// Enhanced mentions component with particle search
export function ParticleMentions({ projectId, value, onChange }: ParticleMentionsProps) {
    const { query, setQuery, results, loading } = useParticleSearch(projectId);
    
    const handleSearch = (searchText: string) => {
        setQuery(searchText);
    };
    
    const mentionOptions = results.map(particle => ({
        value: particle.id,
        label: (
            <div className="particle-mention-option">
                <span className="particle-title">{particle.title}</span>
                <Tag className="particle-type" color="blue">{particle.type}</Tag>
            </div>
        )
    }));
    
    return (
        <Mentions
            value={value}
            onChange={onChange}
            onSearch={handleSearch}
            loading={loading}
            options={mentionOptions}
            placeholder="输入 @ 来搜索相关内容..."
            prefix="@"
            filterOption={false} // We handle filtering on the server
        />
    );
}
```

### **Phase 3: Integration Points**

#### 1. **Server Setup**
```typescript
// Initialize particle system in server startup
export async function initializeParticleSystem(db: Kysely<DB>) {
    const embeddingService = new EmbeddingService();
    const particleExtractor = new ParticleExtractor(embeddingService);
    const particleService = new ParticleService(db, embeddingService, particleExtractor);
    
    // Setup event bus for real-time updates
    const eventBus = new ParticleEventBus(db, particleService);
    
    // Initial particle extraction for existing jsondocs
    await particleService.initializeAllParticles();
    
    return { particleService, eventBus };
}
```

#### 2. **Chat Integration**
```typescript
// Enhanced chat context with particle resolution
export class ChatContextBuilder {
    constructor(private particleService: ParticleService) {}
    
    async buildContext(message: string, projectId: string): Promise<string> {
        // Extract @mentions from message
        const mentions = this.extractMentions(message);
        
        // Resolve particles
        const particles = await Promise.all(
            mentions.map(id => this.particleService.getParticle(id))
        );
        
        // Build context
        const context = particles
            .filter(p => p !== null)
            .map(p => `[${p.type}] ${p.title}: ${p.content_text}`)
            .join('\n\n');
        
        return context;
    }
    
    private extractMentions(text: string): string[] {
        const mentionRegex = /@\[([^\]]+)\]/g;
        const matches = [];
        let match;
        
        while ((match = mentionRegex.exec(text)) !== null) {
            matches.push(match[1]);
        }
        
        return matches;
    }
}
```

## Key Benefits

1. **Real-time Synchronization**: PostgreSQL triggers ensure particles update immediately when jsondocs change
2. **Performance**: Debounced updates prevent excessive processing during rapid edits
3. **Scalability**: pgvector provides efficient similarity search for large datasets
4. **Chinese-Optimized**: Qwen/DeepSeek embeddings understand Chinese content nuances
5. **Lineage-Aware**: Only active (leaf) jsondocs generate @mention-able particles
6. **Framework Integration**: Seamlessly integrates with existing Transform Jsondoc Framework

## Migration Strategy

1. **Phase 1**: Implement core infrastructure (database, services)
2. **Phase 2**: Add @mention UI components and API endpoints
3. **Phase 3**: Integrate with chat system and context construction
4. **Phase 4**: Optimize performance and add advanced features

This approach provides a robust, scalable solution for particle-based semantic search while working within Electric SQL's architectural constraints. 