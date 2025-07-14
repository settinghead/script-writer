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

## Template Particle Integration Design

### **Particle Reference System**

The particle system integrates with templates through a two-stage reference system:

1. **Inline References**: `@particle:particle-id` → expands to alphanumeric references like `[A1]`, `[B2]`, `[C3]`
2. **Content Section**: `%%particle-content%%` → expands to structured YAML content

### **Template Processing Flow**

```typescript
// Example template with particles
const templateWithParticles = `
根据用户需求和以下参考内容生成故事创意：

用户提到的角色 @particle:char-001 和情节 @particle:plot-002 需要重点考虑。
另外，@particle:char-001 的背景设定也很重要。

%%particle-content%%

## 输入参数
%%params%%

## 参考数据  
%%jsondocs%%
`;

// After processing becomes:
const processedTemplate = `
根据用户需求和以下参考内容生成故事创意：

用户提到的角色 [A1] 和情节 [B1] 需要重点考虑。
另外，[A1] 的背景设定也很重要。

## 引用内容

```yaml
A1:
  type: 角色
  title: 苏凌云
  content: |
    苏家遭灭门之灾，苏若水为救重伤兄长假扮林家千金...

B1:
  type: 情节
  title: 禁宫血仇
  content: |
    苏家遭灭门之灾，苏若水为救重伤兄长假扮林家千金嫁给三皇子...
```

## 输入参数
%%params%%

## 参考数据
%%jsondocs%%
`;
```

### **Reference Naming Convention**

- **Alphanumeric Pattern**: `[A1]`, `[A2]`, `[B1]`, `[B2]`, `[C1]`, etc.
- **Grouping Logic**: Same particle type gets same letter prefix
  - `A` series: 角色 (Characters)
  - `B` series: 创意 (Ideas) 
  - `C` series: 卖点 (Selling Points)
  - `D` series: 阶段 (Stages)
  - etc.

### **Template Validation Rules**

1. **Mandatory Content Section**: If any `@particle:id` exists, `%%particle-content%%` must be present
2. **Error Handling**: Throw descriptive error if validation fails
3. **Particle Resolution**: Missing particles are replaced with `[MISSING:particle-id]`

### **Frontend Integration with Ant Design Mentions**

The system integrates with [Ant Design's Mentions component](https://ant.design/components/mentions) for seamless @particle selection in chat interfaces:

```typescript
// ParticleMentions component for chat interfaces
export function ParticleMentions({ projectId, value, onChange }: ParticleMentionsProps) {
    const { query, setQuery, results, loading } = useParticleSearch(projectId);
    
    const handleSearch = (searchText: string) => {
        setQuery(searchText);
    };
    
    const mentionOptions = results.map(particle => ({
        value: `particle:${particle.id}`, // Maps to @particle:particle-id
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
            filterOption={false}
            variant="filled"
            autoSize={{ minRows: 3, maxRows: 8 }}
        />
    );
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

#### 2. **Template Particle Processor**
```typescript
// Core template particle processing service
export class ParticleTemplateProcessor {
    private particleService: ParticleService;
    private typeToPrefix: Map<string, string> = new Map([
        ['角色', 'A'], ['创意', 'B'], ['卖点', 'C'], ['阶段', 'D'],
        ['人物', 'A'], ['情节', 'B'], ['爽点', 'C'], ['场景', 'D']
    ]);
    
    constructor(particleService: ParticleService) {
        this.particleService = particleService;
    }
    
    async processTemplate(
        template: string, 
        projectId: string, 
        userId: string
    ): Promise<string> {
        // 1. Extract particle references
        const particleRefs = this.extractParticleReferences(template);
        
        if (particleRefs.length === 0) {
            return template; // No particles to process
        }
        
        // 2. Validate template structure
        this.validateTemplate(template, particleRefs);
        
        // 3. Resolve particles and build reference map
        const { referenceMap, contentSection } = await this.buildParticleReferences(
            particleRefs, 
            projectId, 
            userId
        );
        
        // 4. Replace inline references
        let result = this.replaceInlineReferences(template, referenceMap);
        
        // 5. Replace content section
        result = result.replace(/%%particle-content%%/g, contentSection);
        
        return result;
    }
    
    private extractParticleReferences(template: string): string[] {
        const regex = /@particle:([a-zA-Z0-9_-]+)/g;
        const matches = [];
        let match;
        
        while ((match = regex.exec(template)) !== null) {
            matches.push(match[1]); // Extract particle ID
        }
        
        return [...new Set(matches)]; // Remove duplicates
    }
    
    private validateTemplate(template: string, particleRefs: string[]): void {
        if (particleRefs.length > 0 && !template.includes('%%particle-content%%')) {
            throw new Error(
                `Template contains particle references (${particleRefs.join(', ')}) but missing %%particle-content%% section`
            );
        }
    }
    
    private async buildParticleReferences(
        particleIds: string[], 
        projectId: string, 
        userId: string
    ): Promise<{ referenceMap: Map<string, string>, contentSection: string }> {
        const referenceMap = new Map<string, string>();
        const contentItems: Array<{ ref: string, type: string, title: string, content: string }> = [];
        const typeCounters = new Map<string, number>();
        
        // Resolve all particles
        for (const particleId of particleIds) {
            try {
                const particle = await this.particleService.getParticle(particleId, projectId, userId);
                
                if (!particle) {
                    referenceMap.set(particleId, `[MISSING:${particleId}]`);
                    continue;
                }
                
                // Generate alphanumeric reference
                const prefix = this.typeToPrefix.get(particle.type) || 'Z';
                const count = (typeCounters.get(prefix) || 0) + 1;
                typeCounters.set(prefix, count);
                const reference = `[${prefix}${count}]`;
                
                referenceMap.set(particleId, reference);
                contentItems.push({
                    ref: reference,
                    type: particle.type,
                    title: particle.title,
                    content: particle.content_text
                });
                
            } catch (error) {
                console.error(`Failed to resolve particle ${particleId}:`, error);
                referenceMap.set(particleId, `[ERROR:${particleId}]`);
            }
        }
        
        // Build content section
        const contentSection = this.buildContentSection(contentItems);
        
        return { referenceMap, contentSection };
    }
    
    private replaceInlineReferences(template: string, referenceMap: Map<string, string>): string {
        let result = template;
        
        for (const [particleId, reference] of referenceMap) {
            const regex = new RegExp(`@particle:${particleId}`, 'g');
            result = result.replace(regex, reference);
        }
        
        return result;
    }
    
    private buildContentSection(contentItems: Array<{ ref: string, type: string, title: string, content: string }>): string {
        if (contentItems.length === 0) {
            return '';
        }
        
        const yamlContent = contentItems.reduce((acc, item) => {
            acc[item.ref.slice(1, -1)] = { // Remove [ and ]
                type: item.type,
                title: item.title,
                content: item.content
            };
            return acc;
        }, {} as any);
        
        return `## 引用内容\n\n\`\`\`yaml\n${dump(yamlContent, { indent: 2, lineWidth: -1 }).trim()}\n\`\`\``;
    }
}
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

### **Phase 2: Template Integration**

#### 1. **Enhanced TemplateService**
```typescript
// Updated TemplateService with particle support
export class TemplateService {
    private templates: Map<string, LLMTemplate> = new Map();
    private particleProcessor: ParticleTemplateProcessor;

    constructor(particleProcessor: ParticleTemplateProcessor) {
        this.particleProcessor = particleProcessor;
        // Register all templates...
    }

    async renderTemplate(
        template: LLMTemplate, 
        context: TemplateContext,
        particleContext?: { projectId: string, userId: string }
    ): Promise<string> {
        let result = template.promptTemplate;

        // NEW: Process particles first (before other replacements)
        if (particleContext) {
            result = await this.particleProcessor.processTemplate(
                result, 
                particleContext.projectId, 
                particleContext.userId
            );
        }

        // Existing replacements
        if (context.params) {
            const paramsYaml = dump(context.params, { indent: 2, lineWidth: -1 }).trim();
            result = result.replace(/%%params%%/g, paramsYaml);
        }

        if (context.jsondocs) {
            const jsondocsYaml = dump(context.jsondocs, { indent: 2, lineWidth: -1 }).trim();
            result = result.replace(/%%jsondocs%%/g, jsondocsYaml);
        }

        return result;
    }
}
```

#### 2. **StreamingTransformExecutor Integration**
```typescript
// Update StreamingTransformExecutor to support particles
export class StreamingTransformExecutor {
    private templateService: TemplateService;
    private particleProcessor: ParticleTemplateProcessor;

    constructor(particleProcessor: ParticleTemplateProcessor) {
        this.templateService = new TemplateService(particleProcessor);
        this.particleProcessor = particleProcessor;
    }

    async executeStreamingTransform<TInput, TOutput>(
        params: StreamingTransformParams<TInput, TOutput>
    ): Promise<StreamingTransformResult> {
        // ... existing logic ...

        // Template rendering with particle support
        const template = this.templateService.getTemplate(config.templateName);
        const templateContext = config.prepareTemplateVariables
            ? await config.prepareTemplateVariables(validatedInput, { jsondocRepo })
            : await defaultPrepareTemplateVariables(validatedInput, jsondocRepo);

        const finalPrompt = await this.templateService.renderTemplate(
            template, 
            templateContext,
            { projectId, userId } // Particle context
        );

        // ... rest of existing logic ...
    }
}
```

### **Phase 3: Frontend @Mention Integration**

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
                const response = await fetch(`/api/particles/search?query=${encodeURIComponent(searchQuery)}&projectId=${projectId}`, {
                    headers: {
                        'Authorization': `Bearer debug-auth-token-script-writer-dev`
                    }
                });
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

#### 3. **Enhanced Ant Design Mentions Component**
```typescript
// Enhanced mentions component with particle search
export interface ParticleMentionsProps {
    projectId: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function ParticleMentions({ 
    projectId, 
    value, 
    onChange, 
    placeholder = "输入 @ 来搜索相关内容...",
    disabled = false,
    className
}: ParticleMentionsProps) {
    const { query, setQuery, results, loading } = useParticleSearch(projectId);
    
    const handleSearch = (searchText: string) => {
        setQuery(searchText);
    };
    
    const mentionOptions = results.map(particle => ({
        value: `particle:${particle.id}`, // Maps to @particle:particle-id
        label: (
            <div className="particle-mention-option" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="particle-title" style={{ fontWeight: 500 }}>{particle.title}</span>
                <Tag className="particle-type" color="blue" size="small">{particle.type}</Tag>
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
            placeholder={placeholder}
            prefix="@"
            filterOption={false} // We handle filtering on the server
            variant="filled"
            autoSize={{ minRows: 3, maxRows: 8 }}
            disabled={disabled}
            className={className}
            style={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#434343',
                color: '#f0f0f0'
            }}
        />
    );
}
```

#### 4. **Enhanced AssistantChatSidebar Integration**
```typescript
// Updated AssistantChatSidebar with particle support
import React, { useState } from 'react';
import { Typography, Button, Tooltip, Modal } from 'antd';
import { Cpu, Trash } from 'iconoir-react';
import { ParticleMentions } from '../particles/ParticleMentions';
import { BasicThread } from './BasicThread';
import { useClearChat } from '../../hooks/useChatMessages';
import { AppColors } from '../../../common/theme/colors';
import './chat.css';

const { Title } = Typography;

interface AssistantChatSidebarProps {
    projectId: string;
}

export const AssistantChatSidebar: React.FC<AssistantChatSidebarProps> = ({ projectId }) => {
    const [messageInput, setMessageInput] = useState('');
    const clearChatMutation = useClearChat(projectId);

    const handleClearChat = () => {
        Modal.confirm({
            title: '确认清空对话',
            content: '确定要清空所有对话记录吗？此操作无法撤销。',
            okText: '确认',
            cancelText: '取消',
            onOk: () => {
                clearChatMutation.mutate();
            },
        });
    };

    const handleSendMessage = () => {
        if (messageInput.trim()) {
            // Send message with particle references
            // The backend will automatically resolve @particle:id references
            // when processing the message through templates
            console.log('Sending message with particles:', messageInput);
            
            // Clear input after sending
            setMessageInput('');
        }
    };

    return (
        <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
            {/* Existing animated background and header */}
            <div className="chat-background">
                <span className="chat-ball"></span>
                <span className="chat-ball"></span>
                <span className="chat-ball"></span>
                <span className="chat-ball"></span>
                <span className="chat-ball"></span>
                <span className="chat-ball"></span>
            </div>

            <div className="chat-header-glass" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '64px',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 10,
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu style={{ fontSize: '20px', color: AppColors.ai.primary }} />
                    <Title level={4} style={{ color: '#f0f0f0', margin: 0 }}>
                        觅光智能体
                    </Title>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <Tooltip title="清空对话">
                        <Button
                            type="text"
                            icon={<Trash style={{ fontSize: 18, color: AppColors.ai.primary }} />}
                            style={{ color: AppColors.ai.primary }}
                            loading={clearChatMutation.isPending}
                            onClick={handleClearChat}
                        />
                    </Tooltip>
                </div>
            </div>

            {/* Main Chat Content */}
            <div style={{
                position: 'absolute',
                top: 64,
                left: 0,
                right: 0,
                bottom: 120, // Leave space for input
                display: 'flex',
                flexDirection: 'column'
            }}>
                <BasicThread projectId={projectId} />
            </div>

            {/* Enhanced Input with Particle Mentions */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '120px',
                padding: '16px',
                backgroundColor: 'rgba(26, 26, 26, 0.95)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <ParticleMentions
                    projectId={projectId}
                    value={messageInput}
                    onChange={setMessageInput}
                    placeholder="输入 @ 来引用相关内容，然后描述您的需求..."
                />
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        type="primary"
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim()}
                        style={{ backgroundColor: AppColors.ai.primary }}
                    >
                        发送
                    </Button>
                </div>
            </div>
        </div>
    );
};
```

#### 5. **Particle Component Styles**
```css
/* Add to chat.css or create particles.css */
.particle-mention-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.particle-mention-option:hover {
    background-color: rgba(64, 169, 255, 0.1);
}

.particle-title {
    font-weight: 500;
    color: #f0f0f0;
    flex: 1;
}

.particle-type {
    font-size: 12px;
    border-radius: 12px;
}

/* Dark theme styling for mentions */
.ant-mentions {
    background-color: #1a1a1a !important;
    border-color: #434343 !important;
    color: #f0f0f0 !important;
}

.ant-mentions-dropdown {
    background-color: #2a2a2a !important;
    border-color: #434343 !important;
}

.ant-mentions-dropdown-menu-item {
    color: #f0f0f0 !important;
}

.ant-mentions-dropdown-menu-item:hover {
    background-color: rgba(64, 169, 255, 0.1) !important;
}

.ant-mentions-dropdown-menu-item-selected {
    background-color: rgba(64, 169, 255, 0.2) !important;
}
```

### **Phase 4: Integration Points**

#### 1. **Server Setup**
```typescript
// Initialize particle system in server startup
export async function initializeParticleSystem(db: Kysely<DB>) {
    const embeddingService = new EmbeddingService();
    const particleExtractor = new ParticleExtractor(embeddingService);
    const particleService = new ParticleService(db, embeddingService, particleExtractor);
    const particleProcessor = new ParticleTemplateProcessor(particleService);
    
    // Setup event bus for real-time updates
    const eventBus = new ParticleEventBus(db, particleService);
    
    // Initial particle extraction for existing jsondocs
    await particleService.initializeAllParticles();
    
    return { particleService, eventBus, particleProcessor };
}
```

#### 2. **AgentRequestBuilder Integration**
```typescript
// Enhanced AgentRequestBuilder with particle support
export async function buildAgentConfiguration(
    request: GeneralAgentRequest,
    projectId: string,
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    userId: string,
    particleProcessor: ParticleTemplateProcessor,
    cachingOptions?: CachingOptions
): Promise<AgentConfiguration> {
    console.log(`[AgentConfigBuilder] Starting configuration build for request: "${request.userRequest}"`);

    const requestType: RequestType = 'general';
    
    // Build context
    const context = await buildContextForRequestType(projectId, jsondocRepo);
    
    // Build prompt with particle resolution
    let prompt = buildPromptForRequestType(request.userRequest, context);
    
    // Process particles in the prompt
    prompt = await particleProcessor.processTemplate(prompt, projectId, userId);
    
    // Build tools with particle support
    const tools = buildToolsForRequestType(
        transformRepo, 
        jsondocRepo, 
        projectId, 
        userId, 
        particleProcessor,
        cachingOptions
    );

    return {
        requestType,
        context,
        prompt,
        tools
    };
}
```

#### 3. **Tool Integration**
```typescript
// Update tool definitions to support particles
export function createBrainstormEditToolDefinition(
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    projectId: string,
    userId: string,
    particleProcessor: ParticleTemplateProcessor,
    cachingOptions?: CachingOptions
): StreamingToolDefinition<BrainstormEditInput, BrainstormEditToolResult> {
    return {
        name: 'edit_brainstorm_ideas',
        description: 'Edit existing brainstorm ideas with particle support',
        inputSchema: BrainstormEditInputSchema,
        outputSchema: BrainstormEditToolResultSchema,
        
        execute: async (params: BrainstormEditInput, { toolCallId }): Promise<BrainstormEditToolResult> => {
            // Create config with particle-enabled template service
            const config: StreamingTransformConfig<BrainstormEditInput, any> = {
                templateName: 'brainstorm_edit',
                inputSchema: BrainstormEditInputSchema,
                outputSchema: z.any(),
                // Custom template preparation with particle support
                prepareTemplateVariables: async (input: BrainstormEditInput, context?: any) => {
                    const defaultVars = await defaultPrepareTemplateVariables(input, context.jsondocRepo);
                    
                    // Process particles in edit requirements
                    if (input.editRequirements) {
                        const processedRequirements = await particleProcessor.processTemplate(
                            input.editRequirements,
                            projectId,
                            userId
                        );
                        defaultVars.params.editRequirements = processedRequirements;
                    }
                    
                    return defaultVars;
                }
            };

            // Execute with particle-enabled template service
            const result = await executeStreamingTransform({
                config,
                input: params,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType: 'brainstorm_idea',
                transformMetadata: {
                    toolName: 'edit_brainstorm_ideas',
                    source_jsondoc_id: params.jsondocs[0].jsondocId,
                    editRequirements: params.editRequirements
                },
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens
            });

            return {
                outputJsondocId: result.outputJsondocId,
                finishReason: result.finishReason
            };
        }
    };
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

### **Phase 1: Core Infrastructure** (Week 1-2)
- Database schema with pgvector support
- Particle extraction and embedding services
- Basic ParticleService with CRUD operations
- PostgreSQL triggers and event bus setup

### **Phase 2: Template Integration** (Week 2-3)
- ParticleTemplateProcessor implementation
- Enhanced TemplateService with particle support
- StreamingTransformExecutor integration
- Template validation and error handling

### **Phase 3: Frontend @Mention Integration** (Week 3-4)
- API endpoints for particle search
- React hooks for particle search
- Enhanced Ant Design Mentions component
- AssistantChatSidebar integration with particle support
- Dark theme styling for particle components

### **Phase 4: Integration Points** (Week 4-5)
- AgentRequestBuilder particle support
- Tool definitions with particle processing
- End-to-end testing and validation
- Performance optimization and caching

### **Phase 5: Advanced Features** (Week 5-6)
- Real-time particle updates via event bus
- Advanced search with semantic similarity
- Particle analytics and usage tracking
- Performance monitoring and optimization

## Key Benefits

1. **Deduplication**: Multiple @mentions of the same particle only include content once
2. **Real-time Synchronization**: PostgreSQL triggers ensure particles update immediately when jsondocs change
3. **Template Validation**: Ensures templates properly handle particles when they're used
4. **Seamless UX**: Ant Design Mentions integration provides smooth @mention experience
5. **Performance**: Debounced updates and pgvector indexing for efficient search
6. **Chinese-Optimized**: Qwen/DeepSeek embeddings understand Chinese content nuances
7. **Framework Integration**: Seamlessly integrates with existing Transform Jsondoc Framework

This approach provides a robust, scalable solution for particle-based semantic search with elegant template integration and user-friendly @mention functionality. 