import { Kysely, sql } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import type { DB } from './types';

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
    provider: string;
    provider_id?: string;
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
    constructor(private db: Kysely<DB>) { }

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
        const now = new Date();

        const userData = {
            id,
            username,
            display_name: displayName || null,
            created_at: now,
            updated_at: now,
            status: 'active'
        };

        await this.db
            .insertInto('users')
            .values(userData)
            .execute();

        return {
            id,
            username,
            display_name: displayName,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
            status: 'active'
        };
    }

    async getUserById(id: string): Promise<User | null> {
        const user = await this.db
            .selectFrom('users')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        if (!user) return null;

        return {
            id: user.id,
            username: user.username,
            display_name: user.username, // Use username as display name
            created_at: user.created_at?.toISOString() || new Date().toISOString(),
            updated_at: user.updated_at?.toISOString() || new Date().toISOString(),
            status: 'active' // Default status
        };
    }

    async getUserByUsername(username: string): Promise<User | null> {
        const user = await this.db
            .selectFrom('users')
            .selectAll()
            .where('username', '=', username)
            .executeTakeFirst();

        if (!user) return null;

        return {
            id: user.id,
            username: user.username,
            display_name: user.username, // Use username as display name
            created_at: user.created_at?.toISOString() || new Date().toISOString(),
            updated_at: user.updated_at?.toISOString() || new Date().toISOString(),
            status: 'active' // Default status
        };
    }

    // Auth provider management
    async createAuthProvider(userId: string, providerType: string, providerUserId?: string, providerData?: any): Promise<AuthProvider> {
        const now = new Date();

        const providerDataToInsert = {
            user_id: userId,
            provider: providerType,
            provider_id: providerUserId || null,
            provider_data: providerData ? JSON.stringify(providerData) : null,
            created_at: now
        };

        const result = await this.db
            .insertInto('auth_providers')
            .values(providerDataToInsert)
            .returning('id')
            .execute();

        const id = result[0]?.id || 0;

        return {
            id,
            user_id: userId,
            provider: providerType,
            provider_id: providerUserId,
            provider_data: providerData,
            created_at: now.toISOString()
        };
    }

    async getUserByProvider(providerType: string, providerUserId: string): Promise<User | null> {
        const user = await this.db
            .selectFrom('users as u')
            .innerJoin('auth_providers as ap', 'u.id', 'ap.user_id')
            .select(['u.id', 'u.username', 'u.created_at', 'u.updated_at'])
            .where('ap.provider', '=', providerType)
            .where('ap.provider_id', '=', providerUserId)
            .executeTakeFirst();

        if (!user) return null;

        return {
            id: user.id,
            username: user.username,
            display_name: user.username, // Use username as display name
            created_at: user.created_at?.toISOString() || new Date().toISOString(),
            updated_at: user.updated_at?.toISOString() || new Date().toISOString(),
            status: 'active' // Default status
        };
    }

    // Session management
    async createSession(sessionId: string, userId: string, expiresAt: Date): Promise<UserSession> {
        const now = new Date();

        const sessionData = {
            id: sessionId,
            user_id: userId,
            expires_at: expiresAt,
            created_at: now
        };

        await this.db
            .insertInto('user_sessions')
            .values(sessionData)
            .execute();

        return {
            id: sessionId,
            user_id: userId,
            expires_at: expiresAt.toISOString(),
            created_at: now.toISOString()
        };
    }

    async getSession(sessionId: string): Promise<UserSession | null> {
        const session = await this.db
            .selectFrom('user_sessions')
            .selectAll()
            .where('id', '=', sessionId)
            .where('expires_at', '>', new Date())
            .executeTakeFirst();

        if (!session) return null;

        return {
            id: session.id,
            user_id: session.user_id,
            expires_at: session.expires_at.toISOString(),
            created_at: session.created_at?.toISOString() || new Date().toISOString()
        };
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.db
            .deleteFrom('user_sessions')
            .where('id', '=', sessionId)
            .execute();
    }

    // Get all test users for dropdown
    async getTestUsers(): Promise<User[]> {
        const users = await this.db
            .selectFrom('users as u')
            .innerJoin('auth_providers as ap', 'u.id', 'ap.user_id')
            .select(['u.id', 'u.username', 'u.created_at', 'u.updated_at'])
            .where('ap.provider', '=', 'test') // Use 'test' provider from our seeded data
            .orderBy('u.username')
            .execute();

        return users.map(user => ({
            id: user.id,
            username: user.username,
            display_name: user.username, // Use username as display name
            created_at: user.created_at?.toISOString() || new Date().toISOString(),
            updated_at: user.updated_at?.toISOString() || new Date().toISOString(),
            status: 'active' // Default status
        }));
    }

    // Clean up expired sessions
    async cleanupExpiredSessions(): Promise<void> {
        await this.db
            .deleteFrom('user_sessions')
            .where('expires_at', '<=', new Date())
            .execute();
    }

    // Check if user can access a room (for YJS WebSocket connections)
    async canUserAccessRoom(roomId: string, userId: string): Promise<boolean> {
        try {
            // Note: This assumes there's a scripts table or similar
            // You may need to adjust this based on your actual room access logic
            const result = await this.db
                .selectFrom('projects as p')
                .innerJoin('projects_users as pu', 'p.id', 'pu.project_id')
                .select('p.id')
                .where('pu.user_id', '=', userId)
                .where('p.id', '=', roomId) // Assuming roomId maps to project ID
                .executeTakeFirst();

            return !!result;
        } catch (error) {
            console.error('Error checking room access:', error);
            return false;
        }
    }

    async getProjectIdsForUser(userId: string): Promise<string[]> {
        const results = await this.db
            .selectFrom('projects_users')
            .select('project_id')
            .where('user_id', '=', userId)
            .execute();
        
        return results.map(row => row.project_id);
    }
} 