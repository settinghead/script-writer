import type { Knex } from 'knex';
import * as path from 'path';

const config: { [key: string]: Knex.Config } = {
    development: {
        client: 'sqlite3',
        connection: {
            filename: './ideations.db'
        },
        useNullAsDefault: true,
        migrations: {
            directory: './src/server/database/migrations',
            extension: 'ts'
        },
        seeds: {
            directory: './src/server/database/seeds',
            extension: 'ts'
        },
        pool: {
            afterCreate: (conn: any, done: any) => {
                // Enable foreign key constraints
                conn.run('PRAGMA foreign_keys = ON', done);
            }
        }
    },

    production: {
        client: 'sqlite3',
        connection: {
            filename: './ideations.db'
        },
        useNullAsDefault: true,
        migrations: {
            directory: './dist-server/src/server/database/migrations',
            extension: 'js'
        },
        seeds: {
            directory: './dist-server/src/server/database/seeds',
            extension: 'js'
        },
        pool: {
            afterCreate: (conn: any, done: any) => {
                conn.run('PRAGMA foreign_keys = ON', done);
            }
        }
    }
};

export default config; 