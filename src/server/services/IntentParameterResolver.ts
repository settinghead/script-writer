import {
    IntentContext,
    IntentContextSchema,
    IntentHandlerParams,
    IntentHandlerParamsSchema
} from '../../common/schemas/intentSchemas.js';
import { createJsondocReference } from '../../common/schemas/common.js';
import { CanonicalJsondocService } from './CanonicalJsondocService.js';
import type { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository.js';
import type { ElectricJsondoc } from '../../common/transform-jsondoc-types.js';

// Dependencies for parameter resolution
type ParameterResolverDependencies = {
    canonicalService: CanonicalJsondocService;
    jsondocRepo: TransformJsondocRepository;
};

// Create a parameter resolver with dependencies captured in closure
export function createIntentParameterResolver(dependencies: ParameterResolverDependencies) {
    const { canonicalService, jsondocRepo } = dependencies;

    // Helper to find canonical jsondocs by schema type from canonical context
    const findCanonicalJsondocsByType = async (
        projectId: string,
        schemaType: string
    ): Promise<ElectricJsondoc[]> => {
        try {
            console.log(`[IntentParameterResolver] Getting canonical data for project: ${projectId}`);
            const { canonicalContext } = await canonicalService.getProjectCanonicalData(projectId);
            console.log(`[IntentParameterResolver] Canonical context keys:`, Object.keys(canonicalContext));

            const results: ElectricJsondoc[] = [];

            // Check individual canonical jsondocs
            console.log(`[IntentParameterResolver] Looking for schema_type: ${schemaType}`);

            if (canonicalContext.canonicalBrainstormInput) {
                console.log(`[IntentParameterResolver] Found canonicalBrainstormInput with schema_type: ${canonicalContext.canonicalBrainstormInput.schema_type}`);
                if (canonicalContext.canonicalBrainstormInput.schema_type === schemaType) {
                    console.log(`[IntentParameterResolver] MATCH! Adding canonicalBrainstormInput to results`);
                    results.push(canonicalContext.canonicalBrainstormInput);
                }
            } else {
                console.log(`[IntentParameterResolver] canonicalBrainstormInput is null/undefined`);
            }

            if (canonicalContext.canonicalBrainstormIdea) {
                console.log(`[IntentParameterResolver] Found canonicalBrainstormIdea with schema_type: ${canonicalContext.canonicalBrainstormIdea.schema_type}`);
                if (canonicalContext.canonicalBrainstormIdea.schema_type === schemaType) {
                    results.push(canonicalContext.canonicalBrainstormIdea);
                }
            }
            if (canonicalContext.canonicalBrainstormCollection) {
                console.log(`[IntentParameterResolver] Found canonicalBrainstormCollection with schema_type: ${canonicalContext.canonicalBrainstormCollection.schema_type}`);
                if (canonicalContext.canonicalBrainstormCollection.schema_type === schemaType) {
                    results.push(canonicalContext.canonicalBrainstormCollection);
                }
            }
            if (canonicalContext.canonicalOutlineSettings?.schema_type === schemaType) {
                results.push(canonicalContext.canonicalOutlineSettings);
            }
            if (canonicalContext.canonicalChronicles?.schema_type === schemaType) {
                results.push(canonicalContext.canonicalChronicles);
            }
            if (canonicalContext.canonicalEpisodePlanning?.schema_type === schemaType) {
                results.push(canonicalContext.canonicalEpisodePlanning);
            }

            // Check arrays
            if (canonicalContext.canonicalEpisodeSynopsisList) {
                canonicalContext.canonicalEpisodeSynopsisList
                    .filter((doc: ElectricJsondoc) => doc.schema_type === schemaType)
                    .forEach((doc: ElectricJsondoc) => results.push(doc));
            }
            if (canonicalContext.canonicalEpisodeScriptsList) {
                canonicalContext.canonicalEpisodeScriptsList
                    .filter((doc: ElectricJsondoc) => doc.schema_type === schemaType)
                    .forEach((doc: ElectricJsondoc) => results.push(doc));
            }

            console.log(`[IntentParameterResolver] Final results for schema_type ${schemaType}:`, results.map(r => ({ id: r.id, schema_type: r.schema_type })));
            return results;
        } catch (error) {
            console.error(`[IntentParameterResolver] Error finding jsondocs for schema_type ${schemaType}:`, error);
            return [];
        }
    };

    // Resolve parameters for brainstorm generation intent
    const resolveBrainstormParameters = async (context: IntentContext): Promise<any> => {
        console.log('[IntentParameterResolver] Resolving brainstorm parameters');

        // Find the brainstorm input params jsondoc
        console.log('[IntentParameterResolver] Finding canonical jsondocs for schema_type: brainstorm_input_params');
        const brainstormInputJsondocs = await findCanonicalJsondocsByType(context.projectId, 'brainstorm_input_params');
        console.log(`[IntentParameterResolver] Found ${brainstormInputJsondocs.length} matching jsondocs`);

        if (brainstormInputJsondocs.length === 0) {
            throw new Error('No brainstorm input parameters found for this project');
        }

        // Use the first (most recent) brainstorm input jsondoc
        const brainstormInputJsondoc = brainstormInputJsondocs[0];

        // Create proper JsondocReference objects
        const jsondocReference = createJsondocReference(
            brainstormInputJsondoc.id,
            '头脑风暴输入参数',
            brainstormInputJsondoc.schema_type
        );

        // Return parameters in the format expected by BrainstormGenerationTool
        return {
            brainstormInputJsondocId: brainstormInputJsondoc.id,
            otherRequirements: context.metadata.userRequirements || '',
            jsondocs: [jsondocReference] // Create proper JsondocReference objects
        };
    };

    // Resolve parameters for other intent types
    const resolveOutlineSettingsParameters = async (context: IntentContext): Promise<any> => {
        // Similar pattern for outline settings
        const outlineInputJsondocs = await findCanonicalJsondocsByType(context.projectId, 'outline_input');
        if (outlineInputJsondocs.length === 0) {
            throw new Error('No outline input parameters found for this project');
        }

        return {
            outlineInputJsondocId: outlineInputJsondocs[0].id,
            jsondocs: []
        };
    };

    const resolveChroniclesParameters = async (context: IntentContext): Promise<any> => {
        // Find brainstorm collection for chronicles generation
        const brainstormCollections = await findCanonicalJsondocsByType(context.projectId, 'brainstorm_idea_collection');
        if (brainstormCollections.length === 0) {
            throw new Error('No brainstorm ideas found for chronicles generation');
        }

        return {
            jsondocs: [brainstormCollections[0].id]
        };
    };

    const resolveEpisodePlanningParameters = async (context: IntentContext): Promise<any> => {
        // Find outline for episode planning
        const outlines = await findCanonicalJsondocsByType(context.projectId, 'outline');
        if (outlines.length === 0) {
            throw new Error('No outline found for episode planning');
        }

        return {
            jsondocs: [outlines[0].id]
        };
    };

    const resolveEpisodeSynopsisParameters = async (context: IntentContext): Promise<any> => {
        // Find episode planning for synopsis generation
        const episodePlanning = await findCanonicalJsondocsByType(context.projectId, 'episode_planning');
        if (episodePlanning.length === 0) {
            throw new Error('No episode planning found for synopsis generation');
        }

        return {
            episodeNumber: context.metadata.episodeNumber || 1,
            jsondocs: [episodePlanning[0].id]
        };
    };

    const resolveEpisodeScriptParameters = async (context: IntentContext): Promise<any> => {
        // Prefer explicit target passed from UI
        const targetSynopsisId: string | undefined = (context.metadata as any)?.episodeSynopsisJsondocId;
        const targetEpisodeNumber: number | undefined = (context.metadata as any)?.episodeNumber;

        let synopsis: ElectricJsondoc | null = null;

        if (targetSynopsisId) {
            // Fetch exact jsondoc by ID and validate type
            const byId = await jsondocRepo.getJsondoc(targetSynopsisId);
            if (!byId) {
                throw new Error(`Episode synopsis not found by ID: ${targetSynopsisId}`);
            }
            if (byId.schema_type !== '单集大纲') {
                throw new Error(`Jsondoc ${targetSynopsisId} is not 单集大纲 (got ${byId.schema_type})`);
            }
            synopsis = byId as ElectricJsondoc;
        } else {
            // Fall back to canonical list search
            const synopses = await findCanonicalJsondocsByType(context.projectId, '单集大纲');
            if (synopses.length === 0) {
                throw new Error('No episode synopsis found for script generation');
            }

            // If an episode number is provided, pick matching one
            if (typeof targetEpisodeNumber === 'number') {
                synopsis = synopses.find(s => {
                    try {
                        const data = typeof (s as any).data === 'string' ? JSON.parse((s as any).data) : (s as any).data;
                        return Number(data?.episodeNumber) === targetEpisodeNumber;
                    } catch {
                        return false;
                    }
                }) || null;
            }

            // Otherwise use the most recent synopsis (first in canonical list)
            if (!synopsis) synopsis = synopses[synopses.length - 1] || synopses[0];
        }

        // Derive episode number from synopsis when not explicitly provided
        let synopsisEpisodeNumber: number | undefined;
        try {
            const data = typeof (synopsis as any).data === 'string' ? JSON.parse((synopsis as any).data) : (synopsis as any).data;
            synopsisEpisodeNumber = typeof data?.episodeNumber === 'number' ? data.episodeNumber : undefined;
        } catch {
            synopsisEpisodeNumber = undefined;
        }

        // Also include canonical 剧本设定 as context for characters/world
        const outlineSettingsList = await findCanonicalJsondocsByType(context.projectId, '剧本设定');
        const outlineSettings = outlineSettingsList[0];

        return {
            episodeNumber: (typeof targetEpisodeNumber === 'number')
                ? targetEpisodeNumber
                : (typeof synopsisEpisodeNumber === 'number')
                    ? synopsisEpisodeNumber
                    : (() => { throw new Error('Episode number is required and could not be inferred from synopsis'); })(),
            episodeSynopsisJsondocId: synopsis!.id,
            userRequirements: (context.metadata as any)?.userRequirements || '',
            jsondocs: [
                createJsondocReference(synopsis!.id, '单集大纲', synopsis!.schema_type),
                ...(outlineSettings ? [createJsondocReference(outlineSettings.id, '剧本设定', outlineSettings.schema_type)] : [])
            ]
        };
    };

    // Main parameter resolution function
    const resolveParameters = async (context: IntentContext): Promise<IntentHandlerParams> => {
        const validatedContext = IntentContextSchema.parse(context);

        let resolvedParams: any;

        switch (validatedContext.intent) {
            case 'generate_brainstorm':
                resolvedParams = await resolveBrainstormParameters(validatedContext);
                break;
            case 'generate_outline_settings':
                resolvedParams = await resolveOutlineSettingsParameters(validatedContext);
                break;
            case 'generate_chronicles':
                resolvedParams = await resolveChroniclesParameters(validatedContext);
                break;
            case 'generate_episode_planning':
                resolvedParams = await resolveEpisodePlanningParameters(validatedContext);
                break;
            case 'generate_episode_synopsis':
                resolvedParams = await resolveEpisodeSynopsisParameters(validatedContext);
                break;
            case 'generate_episode_script':
                resolvedParams = await resolveEpisodeScriptParameters(validatedContext);
                break;
            default:
                throw new Error(`Unsupported intent type: ${validatedContext.intent}`);
        }

        // Validate the resolved parameters
        return IntentHandlerParamsSchema.parse(resolvedParams);
    };

    return {
        resolveParameters
    };
} 