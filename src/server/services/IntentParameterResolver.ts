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
        // Find episode synopsis for script generation
        const episodeSynopsis = await findCanonicalJsondocsByType(context.projectId, 'episode_synopsis');
        if (episodeSynopsis.length === 0) {
            throw new Error('No episode synopsis found for script generation');
        }

        return {
            episodeNumber: context.metadata.episodeNumber || 1,
            jsondocs: [episodeSynopsis[0].id]
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