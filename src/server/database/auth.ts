import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';

export interface User {
    id: string;
    username: string;
    display_name?: string;
    created_at: string;
    updated_at: string;
    status: string;
}

export interface AuthProvider {
    id: number;
    user_id: string;
    provider_type: string;
    provider_user_id?: string;
    provider_data?: any;
    created_at: string;
}

export interface UserSession {
    id: string;
    user_id: string;
    expires_at: string;
    created_at: string;
}

export class AuthDatabase {
    constructor(private db: Knex) { }

    // Initialize authentication tables (now handled by migrations)
    async initializeAuthTables(): Promise<void> {
        // Tables are now created via migrations
        // This method is kept for compatibility but does nothing
        console.log('Authentication tables initialized via migrations');
    }

    // Create test users (now handled by seeds)
    async createTestUsers(): Promise<void> {
        // Test users are now created via seeds
        // This method is kept for compatibility but does nothing
        console.log('Test users initialized via seeds');
    }

    // User management
    async createUser(id: string, username: string, displayName?: string): Promise<User> {
        const now = new Date().toISOString();

        const userData = {
            id,
            username,
            display_name: displayName,
            created_at: now,
            updated_at: now,
            status: 'active'
        };

        await this.db('users').insert(userData);

        return userData;
    }

    async getUserById(id: string): Promise<User | null> {
        const user = await this.db('users')
            .where({ id })
            .first();

        return user || null;
    }

    async getUserByUsername(username: string): Promise<User | null> {
        const user = await this.db('users')
            .where({ username })
            .first();

        return user || null;
    }

    // Auth provider management
    async createAuthProvider(userId: string, providerType: string, providerUserId?: string, providerData?: any): Promise<AuthProvider> {
        const now = new Date().toISOString();

        const providerDataToInsert = {
            user_id: userId,
            provider_type: providerType,
            provider_user_id: providerUserId,
            provider_data: JSON.stringify(providerData),
            created_at: now
        };

        const [id] = await this.db('auth_providers').insert(providerDataToInsert);

        return {
            id,
            user_id: userId,
            provider_type: providerType,
            provider_user_id: providerUserId,
            provider_data: providerData,
            created_at: now
        };
    }

    async getUserByProvider(providerType: string, providerUserId: string): Promise<User | null> {
        const user = await this.db('users as u')
            .join('auth_providers as ap', 'u.id', 'ap.user_id')
            .where({
                'ap.provider_type': providerType,
                'ap.provider_user_id': providerUserId
            })
            .select('u.*')
            .first();

        return user || null;
    }

    // Session management
    async createSession(sessionId: string, userId: string, expiresAt: Date): Promise<UserSession> {
        const now = new Date().toISOString();

        const sessionData = {
            id: sessionId,
            user_id: userId,
            expires_at: expiresAt.toISOString(),
            created_at: now
        };

        await this.db('user_sessions').insert(sessionData);

        return sessionData;
    }

    async getSession(sessionId: string): Promise<UserSession | null> {
        const session = await this.db('user_sessions')
            .where('id', sessionId)
            .where('expires_at', '>', this.db.fn.now())
            .first();

        return session || null;
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.db('user_sessions')
            .where({ id: sessionId })
            .del();
    }

    // Get all test users for dropdown
    async getTestUsers(): Promise<User[]> {
        const users = await this.db('users as u')
            .join('auth_providers as ap', 'u.id', 'ap.user_id')
            .where('ap.provider_type', 'dropdown')
            .select('u.*')
            .orderBy('u.username');

        return users || [];
    }

    // Clean up expired sessions
    async cleanupExpiredSessions(): Promise<void> {
        await this.db('user_sessions')
            .where('expires_at', '<=', this.db.fn.now())
            .del();
    }
} 