// Use dynamic imports for YJS to fix ES module compatibility
import { db } from '../database/connection';
import { TransformJsondocRepository } from './TransformJsondocRepository';


type Database = typeof db;

// YJS types (will be loaded dynamically)
type YDoc = any;
type YMap = any;
type YArray = any;
type YText = any;

export interface YJSDocumentState {
    room_id: string;
    project_id: string;
    jsondoc_id: string;
    document_state: Buffer;
    created_at: Date | string | null;
    updated_at: Date | string | null;
}

export interface YJSAwarenessUpdate {
    client_id: string;
    room_id: string;
    project_id: string;
    jsondoc_id: string;
    update: Buffer;
    created_at?: Date | string | null;
    updated_at: Date | string | null;
}

export class YJSService {
    private documents: Map<string, YDoc> = new Map();
    private persistenceTimers: Map<string, NodeJS.Timeout> = new Map();
    private Y: any = null;

    constructor(
        private db: Database,
        private jsondocRepo: TransformJsondocRepository,
        private transformRepo: TransformJsondocRepository,
    ) { }

    /**
     * Initialize YJS module (dynamic import)
     */
    private async initializeYJS(): Promise<void> {
        if (!this.Y) {
            this.Y = await import('yjs');
        }
    }

    /**
     * Get or create YJS document for an jsondoc
     */
    async getOrCreateDocument(jsondocId: string, projectId: string): Promise<YDoc> {
        await this.initializeYJS();

        const roomId = `jsondoc-${jsondocId}`;

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
            // Initialize with jsondoc data
            await this.initializeDocumentFromJsondoc(doc, jsondocId, projectId);
            // Save initial state
            await this.saveDocumentState(roomId, projectId, jsondocId, doc);
        }

        // Set up persistence on changes
        doc.on('update', (update: Uint8Array) => {
            this.scheduleDocumentPersistence(roomId, projectId, jsondocId, doc);
        });

        this.documents.set(roomId, doc);
        return doc;
    }

    /**
     * Initialize YJS document with jsondoc data
     */
    private async initializeDocumentFromJsondoc(
        doc: YDoc,
        jsondocId: string,
        projectId: string
    ): Promise<void> {
        const jsondoc = await this.jsondocRepo.getJsondoc(jsondocId, projectId);
        if (!jsondoc) {
            throw new Error(`Jsondoc ${jsondocId} not found`);
        }

        let jsondocData: any;
        try {
            jsondocData = typeof jsondoc.data === 'string'
                ? JSON.parse(jsondoc.data)
                : jsondoc.data;
        } catch (error) {
            console.error('Failed to parse jsondoc data:', error);
            jsondocData = {};
        }

        // Initialize YJS structures based on jsondoc data
        const yMap = doc.getMap('content');

        // Recursively populate YJS structures
        this.populateYJSFromObject(yMap, jsondocData);
    }

    /**
     * Recursively populate YJS structures from object data
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
     * Convert YJS document back to plain object
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
        jsondocId: string,
        doc: YDoc
    ): void {
        // Clear existing timer
        if (this.persistenceTimers.has(roomId)) {
            clearTimeout(this.persistenceTimers.get(roomId)!);
        }

        // Schedule new persistence
        const timer = setTimeout(async () => {
            await this.saveDocumentState(roomId, projectId, jsondocId, doc);
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
        jsondocId: string,
        doc: YDoc
    ): Promise<void> {
        try {
            const state = this.Y.encodeStateAsUpdate(doc);
            const now = new Date().toISOString();

            await this.db.insertInto('jsondoc_yjs_documents')
                .values({
                    room_id: roomId,
                    project_id: projectId,
                    jsondoc_id: jsondocId,
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
            const result = await this.db.selectFrom('jsondoc_yjs_documents')
                .selectAll()
                .where('room_id', '=', roomId)
                .executeTakeFirst();

            return result || null;
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
        jsondocId: string,
        update: Buffer
    ): Promise<void> {
        try {
            const now = new Date().toISOString();

            await this.db.insertInto('jsondoc_yjs_awareness')
                .values({
                    client_id: clientId,
                    room_id: roomId,
                    project_id: projectId,
                    jsondoc_id: jsondocId,
                    update: update,
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
            const results = await this.db.selectFrom('jsondoc_yjs_awareness')
                .selectAll()
                .where('room_id', '=', roomId)
                .execute();

            return results;
        } catch (error) {
            console.error('Failed to get awareness updates:', error);
            return [];
        }
    }

    /**
     * Create transform from YJS changes (for audit trail)
     */
    async createTransformFromYJSChanges(
        jsondocId: string,
        projectId: string,
        userId: string,
        doc: YDoc
    ): Promise<void> {
        try {
            const yMap = doc.getMap('content');
            const updatedData = this.convertYJSToObject(yMap);

            // Check if this is a patch jsondoc being edited
            const jsondoc = await this.jsondocRepo.getJsondoc(jsondocId);
            if (jsondoc && jsondoc.schema_type === 'json_patch') {
                console.log('🩹 [YJS] PATCH JSONDOC EDITED:', {
                    jsondocId,
                    projectId,
                    userId,
                    schemaType: jsondoc.schema_type,
                    updatedData
                });

                // TODO: Create human_patch_approval transform when patch jsondoc is edited
                // This is where we should trigger the patch approval workflow
                await this.createHumanPatchApprovalTransform(jsondocId, projectId, userId, updatedData);
            } else {
                console.log('Creating transform from YJS changes:', {
                    jsondocId,
                    projectId,
                    userId,
                    schemaType: jsondoc?.schema_type,
                    updatedData
                });
            }
        } catch (error) {
            console.error('Failed to create transform from YJS changes:', error);
        }
    }

    /**
     * Create human_patch_approval transform when patch jsondoc is edited
     */
    private async createHumanPatchApprovalTransform(
        patchJsondocId: string,
        projectId: string,
        userId: string,
        updatedData: any
    ): Promise<void> {
        try {
            console.log('🚀 [YJS] Creating human_patch_approval transform for patch jsondoc:', patchJsondocId);

            // Create human_patch_approval transform
            const transform = await this.transformRepo.createTransform(
                projectId,
                'human_patch_approval',
                'v1',
                'completed',
                {
                    action_type: 'patch_approval',
                    patch_jsondoc_id: patchJsondocId,
                    user_id: userId,
                    timestamp: new Date().toISOString()
                }
            );

            console.log('✅ [YJS] Created human_patch_approval transform:', transform.id);

            // Link the patch jsondoc as input
            await this.transformRepo.addTransformInputs(transform.id, [
                { jsondocId: patchJsondocId, inputRole: 'patch' }
            ], projectId);

            // Store human transform metadata
            await this.transformRepo.addHumanTransform({
                transform_id: transform.id,
                action_type: 'patch_approval',
                source_jsondoc_id: patchJsondocId,
                derivation_path: '$',
                derived_jsondoc_id: undefined, // No derived jsondoc for patch approval
                transform_name: 'patch_approval',
                change_description: 'User started editing patch content via YJS',
                project_id: projectId
            });

            console.log('✅ [YJS] Human patch approval transform created successfully');

        } catch (error) {
            console.error('❌ [YJS] Failed to create human_patch_approval transform:', error);
        }
    }

    /**
     * Cleanup document and timers
     */
    cleanupDocument(jsondocId: string): void {
        const roomId = `jsondoc-${jsondocId}`;

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
    getDocumentUpdate(jsondocId: string): Uint8Array | null {
        const roomId = `jsondoc-${jsondocId}`;
        const doc = this.documents.get(roomId);

        if (!doc) return null;

        return this.Y.encodeStateAsUpdate(doc);
    }

    /**
     * Apply update to document
     */
    applyUpdateToDocument(jsondocId: string, update: Uint8Array): void {
        const roomId = `jsondoc-${jsondocId}`;
        const doc = this.documents.get(roomId);

        if (!doc) return;

        this.Y.applyUpdate(doc, update);
    }
} 