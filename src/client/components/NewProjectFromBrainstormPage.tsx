import React, { useState } from 'react';
import { Card, Typography, Spin, Flex, App } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import BrainstormingInputForm from './BrainstormingInputForm';

const { Title, Paragraph, Text } = Typography;

interface BrainstormParams {
    platform: string;
    genrePaths: string[][];
    other_requirements?: string;
    numberOfIdeas: number;
}

interface CreateProjectResponse {
    id: string;
    name: string;
}

const NewProjectFromBrainstormPage: React.FC = () => {
    const navigate = useNavigate();
    const { message } = App.useApp();

    // State for BrainstormingInputForm
    const [selectedPlatform, setSelectedPlatform] = useState<string>('抖音');
    const [selectedGenrePaths, setSelectedGenrePaths] = useState<string[][]>([]);
    const [requirements, setRequirements] = useState<string>('');
    const [numberOfIdeas, setNumberOfIdeas] = useState<number>(3);

    // TanStack Query mutation for creating projects and starting brainstorm via chat
    const createProjectMutation = useMutation({
        mutationKey: ['create-project-brainstorm'],
        mutationFn: async (params: BrainstormParams): Promise<CreateProjectResponse> => {
            // Use the existing create-from-brainstorm endpoint that does both steps
            const response = await fetch('/api/projects/create-from-brainstorm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    platform: params.platform,
                    genrePaths: params.genrePaths,
                    other_requirements: params.other_requirements,
                    numberOfIdeas: params.numberOfIdeas
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to create project');
            }

            return response.json();
        },
        onSuccess: (project) => {
            message.success('项目已创建！正在重定向到头脑风暴页面...');
            // Navigate to the project brainstorm page where the chat system will handle the brainstorming
            navigate(`/projects/${project.id}/brainstorm`);
        },
        onError: (error) => {
            console.error('Error creating project:', error);
            message.error(error instanceof Error ? error.message : '创建项目失败。请重试。');
        }
    });

    const handleGenerate = () => {
        // Validate that we have the required data
        if (!selectedPlatform || selectedGenrePaths.length === 0) {
            message.error('请选择平台和故事类型');
            return;
        }

        // Prepare brainstorm parameters
        const params: BrainstormParams = {
            platform: selectedPlatform,
            genrePaths: selectedGenrePaths,
            other_requirements: requirements || undefined,
            numberOfIdeas: numberOfIdeas
        };

        // Use TanStack mutation
        createProjectMutation.mutate(params);
    };

    return (
        <Flex justify="center" align="flex-start" style={{ paddingTop: '2rem' }}>
            <Card style={{ width: 800 }}>
                <Title level={2}>从头脑风暴创建新项目</Title>
                <Paragraph>
                    通过提供一些初始头脑风暴参数来开始一个新项目。AI助手将根据您的输入生成创意故事想法。
                </Paragraph>

                <BrainstormingInputForm
                    selectedPlatform={selectedPlatform}
                    selectedGenrePaths={selectedGenrePaths}
                    requirements={requirements}
                    numberOfIdeas={numberOfIdeas}
                    onPlatformChange={setSelectedPlatform}
                    onGenreSelectionChange={setSelectedGenrePaths}
                    onRequirementsChange={setRequirements}
                    onNumberOfIdeasChange={setNumberOfIdeas}
                    onGenerate={handleGenerate}
                    isGenerating={createProjectMutation.isPending}
                />

                {createProjectMutation.isPending && (
                    <Flex vertical align="center" gap="middle" style={{ marginTop: '2rem' }}>
                        <Spin size="large" />
                        <Text>正在创建您的新项目。您将很快被重定向...</Text>
                    </Flex>
                )}

            </Card>
        </Flex>
    );
};

export default NewProjectFromBrainstormPage; 