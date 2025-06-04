
const config = {
    development: {
        client: 'sqlite3',
        connection: {
            filename: './ideations.db'
        },
        useNullAsDefault: true,
        migrations: {
            directory: './src/server/database/migrations',
            extension: 'js'
        },
        seeds: {
            directory: './src/server/database/seeds',
            extension: 'js'
        },
        pool: {
            afterCreate: (conn, done) => {
                // Enable foreign key constraints
                conn.run('PRAGMA foreign_keys = ON', done);
            }
        }
    },

    production: {
        client: 'sqlite3',
        connection: {
            filename: '/var/data/ideations.db'
        },
        useNullAsDefault: true,
        migrations: {
            directory: './migrations',
            extension: 'js'
        },
        seeds: {
            directory: './seeds',
            extension: 'js'
        },
        pool: {
            afterCreate: (conn, done) => {
                conn.run('PRAGMA foreign_keys = ON', done);
            }
        }
    }
};

export default config; 