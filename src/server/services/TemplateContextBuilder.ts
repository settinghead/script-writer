import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { defaultPrepareTemplateVariables } from '../transform-jsondoc-framework/StreamingTransformExecutor';
import { computeAffectedContextForEdit } from './EditPromptContextService';
import { buildAffectedContextText } from '../tools/shared/contextFormatting';

type BuildContextOptions = {
    toolName?: string;
    projectId: string;
    userId?: string;
    input: any; // Must include jsondocs: [{ jsondocId, schemaType?, description? }]
    jsondocRepo: TransformJsondocRepository;
    transformRepo: TransformJsondocRepository;
};

/**
 * Build template variables (params, jsondocs) exactly like runtime tools.
 * - Uses defaultPrepareTemplateVariables as the base
 * - If edit_* tool, computes upstream diffs and appends to editRequirements
 */
export async function buildToolTemplateContext(opts: BuildContextOptions): Promise<{ params: any; jsondocs: any }> {
    const { toolName, projectId, input, jsondocRepo, transformRepo } = opts;

    // Base extraction (same as runtime)
    const base = await defaultPrepareTemplateVariables(input, jsondocRepo);
    const params = { ...(base.params || {}) } as any;
    const jsondocs = base.jsondocs || {};

    // Upstream diff enrichment for edit tools
    try {
        if (toolName && toolName.startsWith('edit_') && Array.isArray(input?.jsondocs) && input.jsondocs.length > 0) {
            const targetRef = input.jsondocs[0];
            const targetId = targetRef?.jsondocId;
            let schemaType = targetRef?.schemaType;
            if (!schemaType && targetId) {
                const jd = await jsondocRepo.getJsondoc(targetId);
                schemaType = jd?.schema_type;
            }

            if (schemaType && targetId) {
                const affected = await computeAffectedContextForEdit(projectId, schemaType, targetId, jsondocRepo, transformRepo);
                const extra = buildAffectedContextText(affected);
                if (extra) {
                    params.editRequirements = (params.editRequirements || '') + extra;
                }
            }
        }
    } catch {
        // Best-effort enrichment only
    }

    return { params, jsondocs };
}


