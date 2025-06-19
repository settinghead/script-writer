import React, { useState } from 'react';
import { Button, Card, Typography, Spin, Alert, Flex, Form, Input, Space, Divider } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { AgentBrainstormRequest } from '../../common/types';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const NewProjectFromBrainstormPage: React.FC = () => {
    const [form] = Form.useForm();
    const navigate = useNavigate();

    const { mutate: createProject, isPending } = useMutation({
        mutationFn: (request: AgentBrainstormRequest) => apiService.createProjectFromBrainstorm(request),
        onSuccess: (data) => {
            // On success, navigate to the new project page
            if (data.projectId) {
                navigate(`/projects/${data.projectId}`);
            }
        },
        onError: (error) => {
            console.error('Failed to create project from brainstorm:', error);
            // You can show a notification to the user here
        },
    });

    const handleStart = () => {
        form.validateFields().then(values => {
            const userRequest = `I need to create story ideas for ${values.platform || 'social media'} videos. The genre should be ${values.genre || 'any'}. The main story is about a modern CEO who accidentally travels back to ancient times, becomes a fallen noble family's young master, uses modern knowledge for business and court intrigue, eventually becomes incredibly wealthy and wins the heart of a beautiful woman. Keywords should include business warfare, political schemes, and face-slapping moments. The style should be fast-paced with many plot twists.`;

            const request: AgentBrainstormRequest = {
                userRequest,
                platform: values.platform?.trim(),
                genre: values.genre?.trim(),
                other_requirements: values.other_requirements?.trim(),
            };
            createProject(request);
        });
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
                                loading={isPending}
                            >
                                {isPending ? 'Creating Project...' : 'Start Generating'}
                            </Button>
                            <Button onClick={handleReset} disabled={isPending}>
                                Reset
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>

                {isPending && (
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