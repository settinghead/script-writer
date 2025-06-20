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

    // Fetch individual brainstorm_idea artifacts for this project
    const { data: artifacts, isLoading, error } = useShape({
        url: electricConfig.url,
        params: {
            table: 'artifacts',
            where: `project_id = '${projectId}' AND type = 'brainstorm_idea'`
        }
    });

    // Convert artifacts to our expected format and sort by creation time
    const ideaArtifacts = useMemo(() => {
        if (!artifacts || !Array.isArray(artifacts)) return [];

        return (artifacts as unknown as ElectricArtifact[])
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map(artifact => {
                try {
                    const data = JSON.parse(artifact.data as string);
                    return {
                        artifactId: artifact.id,
                        title: data.idea_title || '无标题',
                        body: data.idea_text || '',
                        orderIndex: data.order_index || 0
                    };
                } catch (error) {
                    console.warn('Failed to parse brainstorm idea artifact:', error);
                    return {
                        artifactId: artifact.id,
                        title: '解析错误',
                        body: '',
                        orderIndex: 0
                    };
                }
            })
            .sort((a, b) => a.orderIndex - b.orderIndex);
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

    if (ideaArtifacts.length === 0) {
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
                    创意列表 ({ideaArtifacts.length})
                </h2>
                {isStreaming && (
                    <div className="flex items-center gap-2 text-sm text-blue-400">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        生成中...
                    </div>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {ideaArtifacts.map((idea, index) => (
                    <div key={idea.artifactId} className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-500 font-mono">
                                #{index + 1}
                            </span>
                            <span className="text-xs text-gray-500">
                                ID: {idea.artifactId.slice(-8)}
                            </span>
                        </div>

                        <ArtifactEditor
                            artifactId={idea.artifactId}
                            className="bg-gray-800 hover:bg-gray-750 transition-colors"
                            onTransition={(newArtifactId) => {
                                console.log(`Idea ${index + 1} transitioned from ${idea.artifactId} to ${newArtifactId}`);
                            }}
                        />
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