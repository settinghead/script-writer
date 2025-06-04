import type { EpisodeScriptV1 } from '../../common/streaming/types';

export class ScriptService {
    static async checkScriptExists(episodeId: string, stageId: string): Promise<boolean> {
        try {
            const response = await fetch(`/api/scripts/${episodeId}/${stageId}/exists`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                return false;
            }

            const result = await response.json();
            return result.exists;
        } catch (error) {
            console.error('Error checking script existence:', error);
            return false;
        }
    }

    static async getScript(episodeId: string, stageId: string): Promise<EpisodeScriptV1 | null> {
        try {
            const response = await fetch(`/api/scripts/${episodeId}/${stageId}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting script:', error);
            return null;
        }
    }
} 
 
 
 
 