import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const dbHost = process.env.SUPABASE_DB_HOST;
const dbPort = process.env.SUPABASE_DB_PORT;
const dbUser = process.env.SUPABASE_DB_USER;
const dbPass = process.env.SUPABASE_DB_PASS;

const connectionString = `postgres://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPass)}@${dbHost}:${dbPort}/postgres`;

async function runMigrations() {
    const client = new Client({ connectionString });
    try {
        logger.info('Connecting to the Supabase Postgres instance...', { phase: 'MIGRATION' });
        await client.connect();

        const sqlPath = path.join(process.cwd(), 'src', 'db', 'migrations.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        logger.info('Executing DDL Schema definition...', { phase: 'MIGRATION' });
        await client.query(sql);
        logger.info('Migrations executed successfully.', { phase: 'MIGRATION_SUCCESS' });

        // Confirm execution via information_schema
        logger.info('Validating tables created in public schema:', { phase: 'VALIDATION' });
        const { rows } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

        rows.forEach(r => console.log(` - Table: ${r.table_name}`));

    } catch (err) {
        logger.error(`Migration failed: ${err.message}`, { phase: 'MIGRATION_ERROR' });
        console.error(err);
    } finally {
        await client.end();
    }
}

runMigrations();
