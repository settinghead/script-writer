// Use dynamic imports for YJS to fix ES module compatibility
import { db } from '../database/connection';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';

type Database = typeof db;

// YJS types (loaded dynamically when enabled)
type YDoc = any;
type YMap = any;
type YArray = any;
type YText = any;

export interface YJSDocumentState {
    room_id: string;
    project_id: string;
    artifact_id: string;
    document_state: Buffer;
    created_at: Date | string;
    updated_at: Date | string;
}

export interface YJSAwarenessUpdate {
    client_id: string;
    room_id: string;
    project_id: string;
    update: Buffer;
    artifact_id: string; // Add this field that was missing
    created_at?: Date | string;
    updated_at: Date | string;
}

export class YJSService {
    private documents: Map<string, YDoc> = new Map();
    private persistenceTimers: Map<string, NodeJS.Timeout> = new Map();
    private Y: any = null;

    constructor(
        private db: Database,
        private artifactRepo: ArtifactRepository
    ) { }

    /**
     * Initialize YJS library
     */
    private async initializeYJS(): Promise<void> {
        if (!this.Y) {
            this.Y = await import('yjs');
        }
    }

    async getOrCreateDocument(artifactId: string, projectId: string): Promise<YDoc> {
        await this.initializeYJS();

        const roomId = `artifact-${artifactId}`;

        // Return existing document if already loaded
        if (this.documents.has(roomId)) {
            return this.documents.get(roomId)!;
        }

        // Create new YJS document
        const doc = new this.Y.Doc();

        // Load existing state from database
        const existingState = await this.loadDocumentState(roomId);
        if (existingState) {
            this.Y.applyUpdate(doc, existingState.document_state);
        } else {
            // Initialize with artifact data
            await this.initializeDocumentFromArtifact(doc, artifactId, projectId);
            // Save initial state
            await this.saveDocumentState(roomId, projectId, artifactId, doc);
        }

        // Set up persistence on changes
        doc.on('update', (update: Uint8Array) => {
            this.scheduleDocumentPersistence(roomId, projectId, artifactId, doc);
        });

        this.documents.set(roomId, doc);
        return doc;
    }

    /**
     * Initialize YJS document from artifact data
     */
    private async initializeDocumentFromArtifact(
        doc: YDoc,
        artifactId: string,
        projectId: string
    ): Promise<void> {
        const artifact = await this.artifactRepo.getArtifact(artifactId, projectId);
        if (!artifact) {
            throw new Error(`Artifact ${artifactId} not found`);
        }

        let artifactData: any;
        try {
            artifactData = typeof artifact.data === 'string'
                ? JSON.parse(artifact.data)
                : artifact.data;
        } catch (error) {
            console.error('Failed to parse artifact data:', error);
            artifactData = {};
        }

        // Initialize YJS structures based on artifact data
        const yMap = doc.getMap('content');

        // Recursively populate YJS structures
        this.populateYJSFromObject(yMap, artifactData);
    }

    /**
     * Populate YJS structure from plain object
     */
    private populateYJSFromObject(yParent: YMap | YArray, data: any): void {
        if (typeof data === 'string') {
            // For strings, create Y.Text for collaborative editing
            const yText = new this.Y.Text();
            yText.insert(0, data);
            if (yParent instanceof this.Y.Map) {
                yParent.set('text', yText);
            }
        } else if (Array.isArray(data)) {
            const yArray = new this.Y.Array();
            data.forEach((item, index) => {
                if (typeof item === 'string') {
                    const yText = new this.Y.Text();
                    yText.insert(0, item);
                    yArray.insert(index, [yText]);
                } else if (typeof item === 'object' && item !== null) {
                    const yItemMap = new this.Y.Map();
                    this.populateYJSFromObject(yItemMap, item);
                    yArray.insert(index, [yItemMap]);
                } else {
                    yArray.insert(index, [item]);
                }
            });
            if (yParent instanceof this.Y.Map) {
                yParent.set('array', yArray);
            }
        } else if (typeof data === 'object' && data !== null) {
            Object.entries(data).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    const yText = new this.Y.Text();
                    yText.insert(0, value);
                    if (yParent instanceof this.Y.Map) {
                        yParent.set(key, yText);
                    }
                } else if (Array.isArray(value)) {
                    const yArray = new this.Y.Array();
                    value.forEach((item, index) => {
                        if (typeof item === 'string') {
                            const yText = new this.Y.Text();
                            yText.insert(0, item);
                            yArray.insert(index, [yText]);
                        } else {
                            yArray.insert(index, [item]);
                        }
                    });
                    if (yParent instanceof this.Y.Map) {
                        yParent.set(key, yArray);
                    }
                } else if (typeof value === 'object' && value !== null) {
                    const ySubMap = new this.Y.Map();
                    this.populateYJSFromObject(ySubMap, value);
                    if (yParent instanceof this.Y.Map) {
                        yParent.set(key, ySubMap);
                    }
                } else {
                    if (yParent instanceof this.Y.Map) {
                        yParent.set(key, value);
                    }
                }
            });
        }
    }

    /**
     * Convert YJS structure to plain object
     */
    convertYJSToObject(yStructure: YMap | YArray | YText): any {
        if (yStructure instanceof this.Y.Text) {
            return yStructure.toString();
        } else if (yStructure instanceof this.Y.Array) {
            return yStructure.toArray().map((item: any) => {
                if (item instanceof this.Y.Map || item instanceof this.Y.Array || item instanceof this.Y.Text) {
                    return this.convertYJSToObject(item);
                }
                return item;
            });
        } else if (yStructure instanceof this.Y.Map) {
            const result: any = {};
            yStructure.forEach((value: any, key: string) => {
                if (value instanceof this.Y.Map || value instanceof this.Y.Array || value instanceof this.Y.Text) {
                    result[key] = this.convertYJSToObject(value);
                } else {
                    result[key] = value;
                }
            });
            return result;
        }
        return yStructure;
    }

    /**
     * Schedule document persistence with debouncing
     */
    private scheduleDocumentPersistence(
        roomId: string,
        projectId: string,
        artifactId: string,
        doc: YDoc
    ): void {
        // Clear existing timer
        if (this.persistenceTimers.has(roomId)) {
            clearTimeout(this.persistenceTimers.get(roomId)!);
        }

        // Schedule new persistence
        const timer = setTimeout(async () => {
            await this.saveDocumentState(roomId, projectId, artifactId, doc);
            this.persistenceTimers.delete(roomId);
        }, 1000); // 1 second debounce

        this.persistenceTimers.set(roomId, timer);
    }

    /**
     * Save YJS document state to database
     */
    private async saveDocumentState(
        roomId: string,
        projectId: string,
        artifactId: string,
        doc: YDoc
    ): Promise<void> {
        try {
            const state = this.Y.encodeStateAsUpdate(doc);
            const now = new Date().toISOString();

            await this.db.insertInto('artifact_yjs_documents')
                .values({
                    room_id: roomId,
                    project_id: projectId,
                    artifact_id: artifactId,
                    document_state: Buffer.from(state),
                    created_at: now,
                    updated_at: now
                })
                .onConflict((oc) => oc
                    .column('room_id')
                    .doUpdateSet({
                        document_state: Buffer.from(state),
                        updated_at: now
                    })
                )
                .execute();
        } catch (error) {
            console.error('Failed to save YJS document state:', error);
        }
    }

    /**
     * Load YJS document state from database
     */
    private async loadDocumentState(roomId: string): Promise<YJSDocumentState | null> {
        try {
            const result = await this.db.selectFrom('artifact_yjs_documents')
                .selectAll()
                .where('room_id', '=', roomId)
                .executeTakeFirst();

            return result as YJSDocumentState | null;
        } catch (error) {
            console.error('Failed to load YJS document state:', error);
            return null;
        }
    }

    /**
     * Save awareness update to database
     */
    async saveAwarenessUpdate(
        clientId: string,
        roomId: string,
        projectId: string,
        artifactId: string,
        update: Buffer
    ): Promise<void> {
        try {
            const now = new Date().toISOString();

            await this.db.insertInto('artifact_yjs_awareness')
                .values({
                    client_id: clientId,
                    room_id: roomId,
                    project_id: projectId,
                    artifact_id: artifactId,
                    update: update,
                    created_at: now,
                    updated_at: now
                })
                .onConflict((oc) => oc
                    .columns(['client_id', 'room_id'])
                    .doUpdateSet({
                        update: update,
                        updated_at: now
                    })
                )
                .execute();
        } catch (error) {
            console.error('Failed to save awareness update:', error);
        }
    }

    /**
     * Get awareness updates for a room
     */
    async getAwarenessUpdates(roomId: string): Promise<YJSAwarenessUpdate[]> {
        try {
            const results = await this.db.selectFrom('artifact_yjs_awareness')
                .selectAll()
                .where('room_id', '=', roomId)
                .execute();

            return results as YJSAwarenessUpdate[];
        } catch (error) {
            console.error('Failed to get awareness updates:', error);
            return [];
        }
    }

    /**
     * Create transform from YJS changes (for audit trail)
     */
    async createTransformFromYJSChanges(
        artifactId: string,
        projectId: string,
        userId: string,
        doc: YDoc
    ): Promise<void> {
        try {
            const yMap = doc.getMap('content');
            const updatedData = this.convertYJSToObject(yMap);

            // Create human transform for audit trail
            // This will be implemented when we integrate with the transform system
            console.log('Creating transform from YJS changes:', {
                artifactId,
                projectId,
                userId,
                updatedData
            });
        } catch (error) {
            console.error('Failed to create transform from YJS changes:', error);
        }
    }

    /**
     * Cleanup document and timers
     */
    cleanupDocument(artifactId: string): void {
        const roomId = `artifact-${artifactId}`;

        // Clear persistence timer
        if (this.persistenceTimers.has(roomId)) {
            clearTimeout(this.persistenceTimers.get(roomId)!);
            this.persistenceTimers.delete(roomId);
        }

        // Remove document from memory
        if (this.documents.has(roomId)) {
            const doc = this.documents.get(roomId)!;
            doc.destroy();
            this.documents.delete(roomId);
        }
    }

    /**
     * Get document update for synchronization
     */
    getDocumentUpdate(artifactId: string): Uint8Array | null {
        const roomId = `artifact-${artifactId}`;
        const doc = this.documents.get(roomId);

        if (!doc) return null;

        return this.Y.encodeStateAsUpdate(doc);
    }

    /**
     * Apply update to document
     */
    applyUpdateToDocument(artifactId: string, update: Uint8Array): void {
        const roomId = `artifact-${artifactId}`;
        const doc = this.documents.get(roomId);

        if (!doc) return;

        this.Y.applyUpdate(doc, update);
    }
} 