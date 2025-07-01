import { v4 as uuidv4 } from 'uuid';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { TransformExecutor } from './TransformExecutor';
import { ScriptDocumentV1 } from '../types/artifacts';

export class ScriptService {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformExecutor: TransformExecutor
    ) { }

    // Create a new script document
    async createScript(userId: string, name: string = 'Untitled Script'): Promise<any> {
        const scriptId = uuidv4();
        const roomId = `script-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Create script document artifact
        const scriptArtifact = await this.artifactRepo.createArtifact(
            userId,
            'script_document',
            {
                name,
                room_id: roomId
            } as ScriptDocumentV1,
            'v1', // typeVersion
            undefined, // metadata
            'completed', // streamingStatus
            'user_input' // originType - user created script
        );

        // Create human transform for script creation
        await this.transformExecutor.executeHumanTransform(
            userId,
            [], // No inputs for new script
            'create_script',
            [scriptArtifact],
            {
                interface: 'script_creation',
                script_name: name
            },
            `User created new script: ${name}`
        );

        return {
            id: scriptId,
            name,
            roomId,
            userId
        };
    }

    // Get script by ID
    async getScript(userId: string, scriptId: string): Promise<any | null> {
        // For now, we'll use the script ID to find the artifact
        // In the future, we might need a mapping table
        const scriptArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'script_document');

        // Since we don't have a direct mapping yet, we'll find by script name/room pattern
        // This is temporary - in production we'd store the script ID in the artifact metadata
        const scriptArtifact = scriptArtifacts.find(artifact => {
            // For now, match by creation time or other criteria
            // This is a temporary solution
            return true; // Return the first one for now
        });

        if (!scriptArtifact) {
            return null;
        }

        const scriptData = scriptArtifact.data as ScriptDocumentV1;

        return {
            id: scriptId,
            name: scriptData.name,
            roomId: scriptData.room_id,
            userId,
            createdAt: scriptArtifact.created_at,
            updatedAt: scriptArtifact.created_at // For now, same as created
        };
    }

    // List all scripts for a user
    async listScripts(userId: string): Promise<any[]> {
        const scriptArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'script_document');

        return scriptArtifacts.map(artifact => {
            const scriptData = artifact.data as ScriptDocumentV1;
            return {
                id: artifact.id, // Use artifact ID as script ID for now
                name: scriptData.name,
                roomId: scriptData.room_id,
                createdAt: artifact.created_at,
                updatedAt: artifact.created_at
            };
        });
    }

    // Update script name
    async updateScript(userId: string, scriptId: string, name: string): Promise<boolean> {
        const scriptArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'script_document');
        const scriptArtifact = scriptArtifacts.find(a => a.id === scriptId);

        if (!scriptArtifact) {
            return false;
        }

        // Create new version with updated name (artifacts are immutable)
        const updatedScriptArtifact = await this.artifactRepo.createArtifact(
            userId,
            'script_document',
            {
                ...scriptArtifact.data,
                name
            } as ScriptDocumentV1,
            'v1', // typeVersion
            undefined, // metadata
            'completed', // streamingStatus
            'user_input' // originType - user updated script
        );

        // Create human transform for script update
        await this.transformExecutor.executeHumanTransform(
            userId,
            [scriptArtifact],
            'update_script',
            [updatedScriptArtifact],
            {
                interface: 'script_editor',
                old_name: scriptArtifact.data.name,
                new_name: name
            },
            `User updated script name from "${scriptArtifact.data.name}" to "${name}"`
        );

        return true;
    }

    // Delete script
    async deleteScript(userId: string, scriptId: string): Promise<boolean> {
        const scriptArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'script_document');
        const scriptArtifact = scriptArtifacts.find(a => a.id === scriptId);

        if (!scriptArtifact) {
            return false;
        }

        // Note: In production, we might want to mark as deleted rather than actually delete
        return await this.artifactRepo.deleteArtifact(scriptArtifact.id, userId);
    }
} 