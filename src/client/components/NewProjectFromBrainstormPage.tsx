import React from 'react';
import { Button, Card, Typography, Spin, Flex, Form, Input, Space, Divider, App } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface BrainstormParams {
    genre: string;
    theme: string;
    character_setting: string;
    plot_device: string;
    ending_type: string;
    length: string;
    platform: string;
    additional_requirements?: string;
}

interface CreateProjectResponse {
    projectId: string;
    message: string;
}

const NewProjectFromBrainstormPage: React.FC = () => {
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const { message } = App.useApp();

    // TanStack Query mutation for creating projects with optimistic updates
    const createProjectMutation = useMutation({
        mutationKey: ['create-project'],
        mutationFn: async (params: BrainstormParams): Promise<CreateProjectResponse> => {
            const response = await fetch('/api/brainstorm/create-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ params })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to create project');
            }

            return response.json();
        },
        onSuccess: (data) => {
            message.success('Project created! Redirecting to brainstorm page...');
            // Navigate to the project brainstorm page where Electric will sync the results
            navigate(`/projects/${data.projectId}/brainstorm`);
        },
        onError: (error) => {
            console.error('Error creating project:', error);
            message.error(error instanceof Error ? error.message : 'Failed to create project. Please try again.');
        }
    });

    const handleStart = async () => {
        try {
            const values = await form.validateFields();

            // Prepare brainstorm parameters
            const params: BrainstormParams = {
                genre: values.genre || 'any',
                theme: values.other_requirements || 'general story',
                character_setting: 'modern protagonist',
                plot_device: 'time travel or modern knowledge',
                ending_type: 'happy ending',
                length: 'short form video series',
                platform: values.platform || 'social media',
                additional_requirements: values.other_requirements
            };

            // Use TanStack mutation with optimistic updates
            createProjectMutation.mutate(params);

        } catch (error) {
            console.error('Form validation error:', error);
        }
    };

    const handleReset = () => {
        form.resetFields();
        // Set some example values
        form.setFieldsValue({
            platform: "抖音",
            genre: "穿越, 爽文",
        });
    };

    return (
        <Flex justify="center" align="flex-start" style={{ paddingTop: '2rem' }}>
            <Card style={{ width: 800 }}>
                <Title level={2}>New Project from Brainstorm</Title>
                <Paragraph>
                    Start a new project by providing some initial brainstorming parameters. The AI agent will generate creative story ideas based on your input.
                </Paragraph>

                <Divider />

                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        platform: "抖音",
                        genre: "穿越, 爽文",
                    }}
                >
                    <Form.Item
                        name="platform"
                        label="目标平台"
                        rules={[{ required: true, message: 'Please input the target platform!' }]}
                    >
                        <Input placeholder="例如: 抖音, 快手, YouTube Shorts" />
                    </Form.Item>

                    <Form.Item
                        name="genre"
                        label="故事类型"
                        rules={[{ required: true, message: 'Please input the story genre!' }]}
                    >
                        <Input placeholder="例如: 穿越, 爽文, 甜宠, 悬疑" />
                    </Form.Item>

                    <Form.Item
                        name="other_requirements"
                        label="其他要求"
                    >
                        <TextArea
                            rows={4}
                            placeholder="可以描述您想要的故事核心、人物设定、情节走向等。例如：主角需要有特殊的金手指，情节反转要多。"
                        />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button
                                type="primary"
                                onClick={handleStart}
                                loading={createProjectMutation.isPending}
                            >
                                {createProjectMutation.isPending ? 'Creating Project...' : 'Start Generating'}
                            </Button>
                            <Button onClick={handleReset} disabled={createProjectMutation.isPending}>
                                Reset
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>

                {createProjectMutation.isPending && (
                    <Flex vertical align="center" gap="middle" style={{ marginTop: '2rem' }}>
                        <Spin size="large" />
                        <Text>Your new project is being created. You will be redirected shortly...</Text>
                    </Flex>
                )}

            </Card>
        </Flex>
    );
};

export default NewProjectFromBrainstormPage; 