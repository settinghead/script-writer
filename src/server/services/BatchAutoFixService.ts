import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { createGenericEditToolDefinition } from '../tools/GenericEditTool';

interface AutoFixItem {
    jsondocId: string;
    schemaType: '灵感创意' | '剧本设定' | 'chronicles' | '分集结构';
    editRequirements: string;
    affectedContext?: Array<{ jsondocId: string; schemaType: string; reason: string }>;
}

export class BatchAutoFixService {
    constructor(
        private readonly projectId: string,
        private readonly userId: string,
        private readonly jsondocRepo: TransformJsondocRepository,
        private readonly transformRepo: TransformJsondocRepository
    ) { }

    async run(items: AutoFixItem[]): Promise<{ processed: number; errors: string[] }> {
        const errors: string[] = [];
        let processed = 0;

        await Promise.all(items.map(async (item) => {
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
                    editRequirements: item.editRequirements,
                    affectedContext: item.affectedContext || []
                } as any, { toolCallId: `auto-fix-${Date.now()}` } as any);
                processed += 1;
            } catch (e: any) {
                errors.push(`${item.jsondocId}: ${e?.message || e}`);
            }
        }));

        return { processed, errors };
    }
}


