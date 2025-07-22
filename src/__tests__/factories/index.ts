import { faker } from '@faker-js/faker';
import { Kysely } from 'kysely';
import { DB } from '../../server/database/types';
import { TypedJsondoc } from '../../common/types';

export class TestDataFactory {
    constructor(private db: Kysely<DB>) { }

    async createUser(overrides: Partial<{
        id: string;
        username: string;
        email: string;
    }> = {}) {
        const userData = {
            id: faker.string.uuid(),
            username: faker.internet.userName(),
            email: faker.internet.email(),
            ...overrides
        };

        return await this.db
            .insertInto('users')
            .values(userData)
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async createProject(userId: string, overrides: Partial<{
        id: string;
        name: string;
        description: string;
        project_type: string;
        status: string;
    }> = {}) {
        const projectData = {
            id: faker.string.uuid(),
            name: faker.company.name(),
            description: faker.lorem.paragraph(),
            project_type: 'script',
            status: 'active',
            ...overrides
        };

        const project = await this.db
            .insertInto('projects')
            .values(projectData)
            .returningAll()
            .executeTakeFirstOrThrow();

        // Add user as project member
        await this.db
            .insertInto('projects_users')
            .values({
                project_id: project.id,
                user_id: userId,
                role: 'owner'
            })
            .execute();

        return project;
    }

    async createJsondoc(projectId: string, overrides: Partial<{
        id: string;
        schema_type: TypedJsondoc['schema_type'];
        schema_version: TypedJsondoc['schema_version'];
        origin_type: TypedJsondoc['origin_type'];
        data: any;
        metadata: string | null;
        streaming_status: string | null;
    }> = {}) {
        const defaultData = {
            title: faker.lorem.words(3),
            body: faker.lorem.paragraph()
        };

        const jsondocData = {
            id: faker.string.uuid(),
            project_id: projectId,
            schema_type: 'brainstorm_idea' as TypedJsondoc['schema_type'],
            schema_version: 'v1' as TypedJsondoc['schema_version'],
            origin_type: 'ai_generated' as TypedJsondoc['origin_type'],
            data: JSON.stringify(defaultData),
            metadata: null,
            streaming_status: 'completed',
            ...overrides
        };

        // If data override is provided as object, stringify it
        if (overrides.data && typeof overrides.data === 'object') {
            jsondocData.data = JSON.stringify(overrides.data);
        }

        return await this.db
            .insertInto('jsondocs')
            .values(jsondocData)
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async createBrainstormIdea(projectId: string, overrides: Partial<{
        title: string;
        body: string;
        platform: string;
        genre: string;
    }> = {}) {
        const ideaData = {
            title: faker.lorem.words(3),
            body: faker.lorem.paragraph(3),
            platform: faker.helpers.arrayElement(['抖音', '快手', '小红书', 'YouTube']),
            genre: faker.helpers.arrayElement(['现代甜宠', '古装甜宠', '复仇爽文', '霸总文']),
            ...overrides
        };

        return await this.createJsondoc(projectId, {
            schema_type: 'brainstorm_idea',
            schema_version: 'v1',
            origin_type: 'ai_generated',
            data: ideaData
        });
    }

    async createBrainstormCollection(projectId: string, numIdeas: number = 3, overrides: Partial<{
        platform: string;
        genre: string;
        other_requirements: string;
    }> = {}) {
        const ideas = Array.from({ length: numIdeas }, (_, index) => ({
            title: faker.lorem.words(3),
            body: faker.lorem.paragraph(2),
            metadata: { ideaIndex: index }
        }));

        const collectionData = {
            ideas,
            platform: faker.helpers.arrayElement(['抖音', '快手', '小红书']),
            genre: faker.helpers.arrayElement(['现代甜宠', '古装甜宠', '复仇爽文']),
            other_requirements: faker.lorem.sentence(),
            total_ideas: numIdeas,
            ...overrides
        };

        return await this.createJsondoc(projectId, {
            schema_type: 'brainstorm_collection',
            schema_version: 'v1',
            origin_type: 'ai_generated',
            data: collectionData
        });
    }

    async createOutline(projectId: string, overrides: Partial<{
        title: string;
        genre: string;
        target_episodes: number;
    }> = {}) {
        const outlineData = {
            title: faker.lorem.words(4),
            genre: faker.helpers.arrayElement(['现代言情', '古装言情', '都市甜宠']),
            target_audience: {
                demographic: '18-35岁都市女性',
                core_themes: [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()]
            },
            selling_points: Array.from({ length: 3 }, () => faker.lorem.words(2)),
            satisfaction_points: Array.from({ length: 3 }, () => faker.lorem.words(2)),
            setting: {
                core_setting_summary: faker.lorem.paragraph(),
                key_scenes: Array.from({ length: 4 }, () => faker.lorem.words(3))
            },
            characters: [
                {
                    name: faker.person.fullName(),
                    type: 'male_lead',
                    age: faker.number.int({ min: 25, max: 35 }),
                    background: faker.lorem.sentence(),
                    personality: faker.lorem.words(3)
                },
                {
                    name: faker.person.fullName(),
                    type: 'female_lead',
                    age: faker.number.int({ min: 22, max: 30 }),
                    background: faker.lorem.sentence(),
                    personality: faker.lorem.words(3)
                }
            ],
            synopsis_stages: Array.from({ length: 5 }, () => faker.lorem.paragraph()),
            target_episodes: faker.number.int({ min: 60, max: 100 }),
            ...overrides
        };

        return await this.createJsondoc(projectId, {
            schema_type: 'outline_response',
            schema_version: 'v1',
            origin_type: 'ai_generated',
            data: outlineData
        });
    }

    async createTransform(projectId: string, overrides: Partial<{
        id: string;
        type: string;
        status: string;
        streaming_status: string;
        execution_context: any;
    }> = {}) {
        const transformData = {
            id: faker.string.uuid(),
            project_id: projectId,
            type: faker.helpers.arrayElement(['brainstorm', 'outline', 'edit']),
            status: 'completed',
            streaming_status: 'completed',
            execution_context: {},
            ...overrides
        };

        return await this.db
            .insertInto('transforms')
            .values(transformData)
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async createHumanTransform(projectId: string, overrides: Partial<{
        id: string;
        transform_name: string;
        artifact_path: string;
        patches: any;
        status: string;
    }> = {}) {
        const humanTransformData = {
            id: faker.string.uuid(),
            project_id: projectId,
            transform_name: 'brainstorm_edit',
            artifact_path: '/ideas/0',
            patches: JSON.stringify([
                { op: 'replace', path: '/title', value: faker.lorem.words(3) }
            ]),
            status: 'completed',
            ...overrides
        };

        return await this.db
            .insertInto('human_transforms')
            .values(humanTransformData)
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async createChatMessage(projectId: string, overrides: Partial<{
        id: string;
        role: string;
        content: string;
        tool_name: string | null;
        tool_parameters: any;
        tool_result: any;
    }> = {}) {
        const messageData = {
            id: faker.string.uuid(),
            project_id: projectId,
            role: faker.helpers.arrayElement(['user', 'assistant', 'system']),
            content: faker.lorem.paragraph(),
            tool_name: null,
            tool_parameters: null,
            tool_result: null,
            metadata: null,
            ...overrides
        };

        return await this.db
            .insertInto('chat_messages_raw')
            .values(messageData)
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async createParticle(projectId: string, jsondocId: string, overrides: Partial<{
        id: string;
        particle_type: string;
        content: string;
        embedding: number[] | null;
        metadata: any;
    }> = {}) {
        const particleData = {
            id: faker.string.uuid(),
            project_id: projectId,
            jsondoc_id: jsondocId,
            particle_type: 'jsondoc_content',
            content: faker.lorem.paragraph(),
            embedding: null,
            metadata: {},
            content_hash: faker.string.alphanumeric(32),
            ...overrides
        };

        return await this.db
            .insertInto('particles')
            .values(particleData)
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    // Convenience method to create a complete project setup
    async createProjectSetup(overrides: {
        userId?: string;
        projectName?: string;
        numIdeas?: number;
    } = {}) {
        // Create user if not provided
        const user = overrides.userId
            ? await this.db.selectFrom('users').selectAll().where('id', '=', overrides.userId).executeTakeFirst()
            : await this.createUser();

        if (!user) {
            throw new Error('User not found');
        }

        // Create project
        const project = await this.createProject(user.id, {
            name: overrides.projectName || faker.company.name()
        });

        // Create some brainstorm ideas
        const numIdeas = overrides.numIdeas || 3;
        const brainstormCollection = await this.createBrainstormCollection(project.id, numIdeas);

        // Create an outline
        const outline = await this.createOutline(project.id);

        return {
            user,
            project,
            brainstormCollection,
            outline
        };
    }
} 