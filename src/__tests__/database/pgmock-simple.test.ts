import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresMock } from 'pgmock';
import { Client } from 'pg';

describe('PGMock Simple Test', () => {
    let pgMock: PostgresMock;
    let client: Client;

    beforeAll(async () => {
        // Create PostgresMock instance
        pgMock = await PostgresMock.create();

        // Get the node-postgres configuration
        const pgConfig = pgMock.getNodePostgresConfig();

        // Create a client connection
        client = new Client(pgConfig);
        await client.connect();
    }, 60000);

    afterAll(async () => {
        if (client) {
            await client.end();
        }
        if (pgMock) {
            pgMock.destroy();
        }
    });

    it('should connect and execute basic queries', async () => {
        // Test basic query
        const result = await client.query('SELECT $1::text as message', ['Hello world!']);

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].message).toBe('Hello world!');
    });

    it('should create and query tables', async () => {
        // Create a simple table
        await client.query(`
      CREATE TABLE test_users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE
      )
    `);

        // Insert data
        await client.query(
            'INSERT INTO test_users (name, email) VALUES ($1, $2)',
            ['John Doe', 'john@example.com']
        );

        // Query data
        const result = await client.query('SELECT * FROM test_users');

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].name).toBe('John Doe');
        expect(result.rows[0].email).toBe('john@example.com');
        expect(result.rows[0].id).toBe(1);
    });

    it('should handle transactions', async () => {
        await client.query('BEGIN');

        try {
            await client.query(
                'INSERT INTO test_users (name, email) VALUES ($1, $2)',
                ['Jane Doe', 'jane@example.com']
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }

        // Verify the transaction worked
        const result = await client.query('SELECT COUNT(*) FROM test_users');
        expect(Number(result.rows[0].count)).toBe(2);
    });
}); 