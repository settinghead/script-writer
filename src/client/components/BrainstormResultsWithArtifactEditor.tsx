import React, { useMemo } from 'react';
import { useShape } from '@electric-sql/react';
import { ArtifactEditor } from './shared/ArtifactEditor';
import { getElectricConfig } from '../../common/config/electric';
import type { ElectricArtifact, IdeaWithTitle } from '../../common/types';

interface BrainstormResultsWithArtifactEditorProps {
    projectId: string;
    isStreaming: boolean;
}

export const BrainstormResultsWithArtifactEditor: React.FC<BrainstormResultsWithArtifactEditorProps> = ({
    projectId,
    isStreaming
}) => {
    const electricConfig = getElectricConfig();

    // Fetch brainstorm_idea_collection artifacts (not individual ideas)
    const { data: artifacts, isLoading, error } = useShape({
        url: electricConfig.url,
        params: {
            table: 'artifacts',
            where: `project_id = '${projectId}' AND type = 'brainstorm_idea_collection'`
        }
    });

    // Get the latest collection artifact and parse ideas from it
    const { latestCollection, ideas } = useMemo(() => {
        if (!artifacts || !Array.isArray(artifacts)) return { latestCollection: null, ideas: [] };
        
        const latestCollection = (artifacts as unknown as ElectricArtifact[])
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        
        if (!latestCollection?.data) return { latestCollection, ideas: [] };
        
        try {
            const data = JSON.parse(latestCollection.data as string);
            const ideas = Array.isArray(data) ? data : data.ideas || [];
            return { latestCollection, ideas };
        } catch (error) {
            console.warn('Failed to parse collection data:', error);
            return { latestCollection, ideas: [] };
        }
    }, [artifacts]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse bg-gray-800 h-32 rounded-lg"></div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <div className="text-red-400 mb-2">⚠️ 加载失败</div>
                <p className="text-gray-400 text-sm">{error.message}</p>
            </div>
        );
    }

    if (!latestCollection || ideas.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-4xl mb-4">💡</div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                    {isStreaming ? '正在生成创意...' : '暂无创意'}
                </h3>
                <p className="text-gray-400 text-sm">
                    {isStreaming ? '创意将会逐个出现在这里' : '开始头脑风暴以生成创意'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">
                    创意列表 ({ideas.length})
                </h2>
                {isStreaming && (
                    <div className="flex items-center gap-2 text-sm text-blue-400">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        生成中...
                    </div>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {ideas.map((idea, index) => (
                    <div key={index} className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-500 font-mono">
                                #{index + 1}
                            </span>
                            <span className="text-xs text-gray-500">
                                Collection: {latestCollection.id.slice(-8)}
                            </span>
                        </div>

                        {/* Edit title with path-based derivation */}
                        <div className="mb-2">
                            <label className="text-xs text-gray-400 mb-1 block">标题</label>
                            <ArtifactEditor
                                artifactId={latestCollection.id}
                                path={`[${index}].title`}
                                className="bg-gray-800 hover:bg-gray-750 transition-colors"
                                onTransition={(newArtifactId) => {
                                    console.log(`Idea ${index + 1} title transitioned to ${newArtifactId}`);
                                }}
                            />
                        </div>

                        {/* Edit body with path-based derivation */}
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">内容</label>
                            <ArtifactEditor
                                artifactId={latestCollection.id}
                                path={`[${index}].body`}
                                className="bg-gray-800 hover:bg-gray-750 transition-colors"
                                onTransition={(newArtifactId) => {
                                    console.log(`Idea ${index + 1} body transitioned to ${newArtifactId}`);
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {isStreaming && (
                <div className="text-center text-sm text-gray-400 mt-6">
                    💡 新创意正在生成中，将自动显示在上方
                </div>
            )}
        </div>
    );
}; 