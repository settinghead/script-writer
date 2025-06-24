import React from 'react';
import { Button, Card, Typography, Spin, Flex, Form, Input, Space, Divider, App } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface BrainstormParams {
    platform: string;
    genre: string;
    other_requirements?: string;
}

interface CreateProjectResponse {
    id: string;
    name: string;
}

const NewProjectFromBrainstormPage: React.FC = () => {
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const { message } = App.useApp();

    // TanStack Query mutation for creating projects and starting brainstorm via chat
    const createProjectMutation = useMutation({
        mutationKey: ['create-project-brainstorm'],
        mutationFn: async (params: BrainstormParams): Promise<CreateProjectResponse> => {
            // 1. Create a new project first
            const projectResponse = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: `头脑风暴项目 - ${new Date().toLocaleString()}`,
                    description: `${params.platform}平台的${params.genre}类型故事创意`,
                    project_type: 'script'
                })
            });

            if (!projectResponse.ok) {
                const errorData = await projectResponse.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to create project');
            }

            const project = await projectResponse.json();

            // 2. Send a brainstorm message via chat system
            const brainstormMessage = `为${params.platform}平台生成创意故事想法。
类型：${params.genre}
${params.other_requirements ? `其他要求：${params.other_requirements}` : ''}

请生成几个有创意的故事想法，要符合平台特点和类型要求。`;

            const chatResponse = await fetch(`/api/chat/projects/${project.id}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: brainstormMessage
                })
            });

            if (!chatResponse.ok) {
                console.warn('Failed to send initial brainstorm message, but project was created');
                // Don't throw error - project was created successfully
            }

            return project;
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

    const handleStart = async () => {
        try {
            const values = await form.validateFields();

            // Prepare brainstorm parameters
            const params: BrainstormParams = {
                platform: values.platform || '抖音',
                genre: values.genre || '穿越, 爽文',
                other_requirements: values.other_requirements
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
                <Title level={2}>从头脑风暴创建新项目</Title>
                <Paragraph>
                    通过提供一些初始头脑风暴参数来开始一个新项目。AI助手将根据您的输入生成创意故事想法。
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
                        rules={[{ required: true, message: '请输入目标平台！' }]}
                    >
                        <Input placeholder="例如: 抖音, 快手, YouTube Shorts" />
                    </Form.Item>

                    <Form.Item
                        name="genre"
                        label="故事类型"
                        rules={[{ required: true, message: '请输入故事类型！' }]}
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
                                {createProjectMutation.isPending ? '正在创建项目...' : '开始生成'}
                            </Button>
                            <Button onClick={handleReset} disabled={createProjectMutation.isPending}>
                                重置
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>

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