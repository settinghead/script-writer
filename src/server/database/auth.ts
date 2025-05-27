import * as sqlite3 from 'sqlite3';
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
    constructor(private db: sqlite3.Database) { }

    // Initialize authentication tables
    initializeAuthTables(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Create users table
                this.db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            display_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'active'
          )
        `, (err) => {
                    if (err) {
                        console.error('Error creating users table:', err);
                        reject(err);
                        return;
                    }
                });

                // Create auth_providers table
                this.db.run(`
          CREATE TABLE IF NOT EXISTS auth_providers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            provider_type TEXT NOT NULL,
            provider_user_id TEXT,
            provider_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            UNIQUE(provider_type, provider_user_id)
          )
        `, (err) => {
                    if (err) {
                        console.error('Error creating auth_providers table:', err);
                        reject(err);
                        return;
                    }
                });

                // Create user_sessions table
                this.db.run(`
          CREATE TABLE IF NOT EXISTS user_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `, (err) => {
                    if (err) {
                        console.error('Error creating user_sessions table:', err);
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
        });
    }

    // Create test users
    async createTestUsers(): Promise<void> {
        const testUsers = [
            { id: 'test-user-xiyang', username: 'xiyang', display_name: 'Xi Yang' },
            { id: 'test-user-xiaolin', username: 'xiaolin', display_name: 'Xiao Lin' },
            { id: 'test-user-giselle', username: 'giselle', display_name: 'Giselle' }
        ];

        for (const user of testUsers) {
            try {
                await this.createUser(user.id, user.username, user.display_name);
                await this.createAuthProvider(user.id, 'dropdown', user.username);
            } catch (error) {
                // Ignore if user already exists
                if (!(error as Error).message.includes('UNIQUE constraint failed')) {
                    console.error(`Error creating test user ${user.username}:`, error);
                }
            }
        }
    }

    // User management
    createUser(id: string, username: string, displayName?: string): Promise<User> {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
        INSERT INTO users (id, username, display_name)
        VALUES (?, ?, ?)
      `);

            stmt.run([id, username, displayName], function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                // Return the created user
                resolve({
                    id,
                    username,
                    display_name: displayName,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    status: 'active'
                });
            });

            stmt.finalize();
        });
    }

    getUserById(id: string): Promise<User | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE id = ?',
                [id],
                (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(row || null);
                }
            );
        });
    }

    getUserByUsername(username: string): Promise<User | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE username = ?',
                [username],
                (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(row || null);
                }
            );
        });
    }

    // Auth provider management
    createAuthProvider(userId: string, providerType: string, providerUserId?: string, providerData?: any): Promise<AuthProvider> {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
        INSERT INTO auth_providers (user_id, provider_type, provider_user_id, provider_data)
        VALUES (?, ?, ?, ?)
      `);

            stmt.run([userId, providerType, providerUserId, JSON.stringify(providerData)], function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve({
                    id: this.lastID,
                    user_id: userId,
                    provider_type: providerType,
                    provider_user_id: providerUserId,
                    provider_data: providerData,
                    created_at: new Date().toISOString()
                });
            });

            stmt.finalize();
        });
    }

    getUserByProvider(providerType: string, providerUserId: string): Promise<User | null> {
        return new Promise((resolve, reject) => {
            this.db.get(`
        SELECT u.* FROM users u
        JOIN auth_providers ap ON u.id = ap.user_id
        WHERE ap.provider_type = ? AND ap.provider_user_id = ?
      `, [providerType, providerUserId], (err, row: any) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row || null);
            });
        });
    }

    // Session management
    createSession(sessionId: string, userId: string, expiresAt: Date): Promise<UserSession> {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
        INSERT INTO user_sessions (id, user_id, expires_at)
        VALUES (?, ?, ?)
      `);

            stmt.run([sessionId, userId, expiresAt.toISOString()], function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve({
                    id: sessionId,
                    user_id: userId,
                    expires_at: expiresAt.toISOString(),
                    created_at: new Date().toISOString()
                });
            });

            stmt.finalize();
        });
    }

    getSession(sessionId: string): Promise<UserSession | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM user_sessions WHERE id = ? AND expires_at > datetime("now")',
                [sessionId],
                (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(row || null);
                }
            );
        });
    }

    deleteSession(sessionId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM user_sessions WHERE id = ?',
                [sessionId],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                }
            );
        });
    }

    // Get all test users for dropdown
    getTestUsers(): Promise<User[]> {
        return new Promise((resolve, reject) => {
            this.db.all(`
        SELECT u.* FROM users u
        JOIN auth_providers ap ON u.id = ap.user_id
        WHERE ap.provider_type = 'dropdown'
        ORDER BY u.username
      `, (err, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows || []);
            });
        });
    }

    // Clean up expired sessions
    cleanupExpiredSessions(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM user_sessions WHERE expires_at <= datetime("now")',
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                }
            );
        });
    }
} 