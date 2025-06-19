import React, { useState } from 'react';
import { Button, Card, Typography, Spin, Alert, Form, Space, Input, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface BrainstormingParams {
    platform: string;
    genre: string;
    other_requirements?: string;
}

interface ProjectCreationRequest {
    platform: string;
    genrePaths: string[][];
}

interface BrainstormingRequest {
    platform: string;
    genrePaths: string[][];
    requirements: string;
}

const NewProjectFromBrainstormingPage: React.FC = () => {
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const [isCreatingProject, setIsCreatingProject] = useState(false);

    // Parse genre string into genre paths
    const parseGenrePaths = (genreString: string): string[][] => {
        if (!genreString || !genreString.trim()) return [];
        
        // Split by comma and create simple paths
        return genreString
            .split(',')
            .map(genre => genre.trim())
            .filter(genre => genre.length > 0)
            .map(genre => [genre]); // Simple single-level paths
    };

    const handleStartGenerating = async () => {
        try {
            const values = form.getFieldsValue();
            setIsCreatingProject(true);

            // Parse the form values
            const platform = values.platform?.trim() || '抖音';
            const genrePaths = parseGenrePaths(values.genre || '');
            const requirements = values.other_requirements?.trim() || '';

            // Step 1: Create project
            const projectResponse = await fetch('/api/projects/create-for-brainstorm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    platform,
                    genrePaths
                }),
            });

            if (!projectResponse.ok) {
                throw new Error(`Failed to create project: ${projectResponse.status}`);
            }

            const project = await projectResponse.json();
            console.log('Created project:', project);

            // Step 2: Start brainstorming for the project
            const brainstormResponse = await fetch(`/api/ideations/${project.id}/brainstorm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    platform,
                    genrePaths,
                    requirements
                }),
            });

            if (!brainstormResponse.ok) {
                throw new Error(`Failed to start brainstorming: ${brainstormResponse.status}`);
            }

            const brainstormResult = await brainstormResponse.json();
            console.log('Started brainstorming:', brainstormResult);

            // Step 3: Navigate to project page
            message.success('项目创建成功，正在生成创意...');
            navigate(`/projects/${project.id}`);

        } catch (error: any) {
            console.error('Error creating project and starting brainstorming:', error);
            message.error(`创建失败: ${error.message}`);
        } finally {
            setIsCreatingProject(false);
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
        <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            <Card>
                <Title level={2}>创建新项目并生成创意</Title>
                <Paragraph>
                    填写以下信息来创建新项目并开始生成故事创意。系统将自动为您创建项目并开始智能创意生成。
                </Paragraph>

                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        platform: "抖音",
                        genre: "穿越, 爽文",
                    }}
                >
                    <Form.Item
                        label="目标平台"
                        name="platform"
                        rules={[{ required: true, message: '请输入目标平台' }]}
                    >
                        <Input placeholder="如：抖音、快手、小红书等" />
                    </Form.Item>

                    <Form.Item
                        label="故事类型"
                        name="genre"
                        rules={[{ required: true, message: '请输入故事类型' }]}
                    >
                        <Input placeholder="如：穿越, 爽文, 甜宠等，用逗号分隔" />
                    </Form.Item>

                    <Form.Item
                        label="其他要求"
                        name="other_requirements"
                    >
                        <TextArea
                            rows={4}
                            placeholder="请描述您对故事的具体要求，如人物设定、情节偏好等..."
                        />
                    </Form.Item>

                    <Space>
                        <Button
                            type="primary"
                            size="large"
                            onClick={handleStartGenerating}
                            loading={isCreatingProject}
                            disabled={isCreatingProject}
                        >
                            {isCreatingProject ? '正在创建项目...' : '开始生成'}
                        </Button>
                        <Button size="large" onClick={handleReset}>
                            重置表单
                        </Button>
                    </Space>
                </Form>

                {isCreatingProject && (
                    <Alert
                        style={{ marginTop: '16px' }}
                        message="正在创建项目..."
                        description="系统正在为您创建新项目并启动智能创意生成，请稍候..."
                        type="info"
                        showIcon
                    />
                )}

                <div style={{ marginTop: '24px', padding: '16px', borderRadius: '6px' }}>
                    <Text type="secondary">
                        <strong>说明：</strong>
                        点击"开始生成"后，系统将：
                        <br />
                        1. 根据您的输入创建新项目
                        <br />
                        2. 启动智能创意生成流程
                        <br />
                        3. 自动跳转到项目页面查看实时生成结果
                    </Text>
                </div>
            </Card>
        </div>
    );
};

export default NewProjectFromBrainstormingPage; 