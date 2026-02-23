import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const connectionString = `postgres://${encodeURIComponent(process.env.SUPABASE_DB_USER)}:${encodeURIComponent(process.env.SUPABASE_DB_PASS)}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT}/postgres`;

async function run() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const sql = fs.readFileSync(path.join(process.cwd(), 'src', 'db', 'migration-cost-tracking.sql'), 'utf8');
        logger.info('Running cost tracking migration...', { phase: 'MIGRATION' });
        await client.query(sql);
        logger.info('Cost tracking migration complete.', { phase: 'MIGRATION_SUCCESS' });

        const { rows } = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'api_usage_logs' ORDER BY ordinal_position;`);
        console.log('\\napi_usage_logs columns:');
        rows.forEach(r => console.log(`  - ${r.column_name}`));
    } catch (err) {
        logger.error(`Migration failed: ${err.message}`, { phase: 'MIGRATION_ERROR' });
        console.error(err);
    } finally {
        await client.end();
    }
}
run();
