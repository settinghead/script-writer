import knex, { Knex } from 'knex';
import config from "./knexfile.js";

const environment = process.env.NODE_ENV || 'development';
const knexConfig = (config as any)[environment];
// Create the database connection
export const db: Knex = knex(knexConfig);

// Initialize database with migrations and seeds
export const initializeDatabase = async (): Promise<void> => {
    try {
        // Run migrations
        await db.migrate.latest();
        console.log('Database migrations completed');

        // Run seeds in development
        if (environment === 'development') {
            await db.seed.run();
            console.log('Database seeds completed');
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
};

// Graceful shutdown
export const closeDatabase = async (): Promise<void> => {
    try {
        await db.destroy();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error closing database:', error);
    }
};

export default db; 