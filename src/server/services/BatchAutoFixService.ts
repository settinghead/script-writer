import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { createGenericEditToolDefinition } from '../tools/GenericEditTool';
import { EventEmitter } from 'events';

interface AutoFixItem {
    jsondocId: string;
    schemaType: '灵感创意' | '剧本设定' | 'chronicles' | '分集结构';
    editRequirements: string;
}

export class BatchAutoFixService {
    private static projectEmitters: Map<string, EventEmitter> = new Map();

    static getEmitter(projectId: string): EventEmitter {
        if (!this.projectEmitters.has(projectId)) {
            this.projectEmitters.set(projectId, new EventEmitter());
        }
        return this.projectEmitters.get(projectId)!;
    }
    constructor(
        private readonly projectId: string,
        private readonly userId: string,
        private readonly jsondocRepo: TransformJsondocRepository,
        private readonly transformRepo: TransformJsondocRepository
    ) { }

    async run(items: AutoFixItem[]): Promise<{ processed: number; errors: string[] }> {
        const errors: string[] = [];
        let processed = 0;

        const emitter = BatchAutoFixService.getEmitter(this.projectId);
        emitter.emit('message', { type: 'start', total: items.length });

        for (const item of items) {
            try {
                const tool = createGenericEditToolDefinition(
                    item.schemaType,
                    this.transformRepo,
                    this.jsondocRepo,
                    this.projectId,
                    this.userId,
                    { enableCaching: true }
                );
                if (!tool) {
                    throw new Error(`Unsupported schema: ${item.schemaType}`);
                }
                await tool.execute({
                    jsondocId: item.jsondocId,
                    editRequirements: item.editRequirements
                } as any, { toolCallId: `auto-fix-${Date.now()}` } as any);
                processed += 1;
                emitter.emit('message', { type: 'progress', processed, total: items.length, lastJsondocId: item.jsondocId });
            } catch (e: any) {
                errors.push(`${item.jsondocId}: ${e?.message || e}`);
                emitter.emit('message', { type: 'error', jsondocId: item.jsondocId, error: String(e?.message || e) });
            }
        }

        emitter.emit('message', { type: 'done', processed, total: items.length, errors });
        return { processed, errors };
    }
}


