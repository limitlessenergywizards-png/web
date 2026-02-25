import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../../utils/logger.js';

// Load env from the config/.env path
dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    logger.error('Missing Supabase credentials in config/.env!', { phase: 'DB_INIT' });
    process.exit(1);
}

// Client for regular operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for admin/server-side operations (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function testConnection() {
    try {
        const { data, error } = await supabase.from('projects').select('id').limit(1);
        if (error) {
            logger.error(`Supabase Connection failed: ${error.message}`, { phase: 'DB_TEST' });
            return false;
        }
        logger.info('Supabase Connection successful! Database is reachable.', { phase: 'DB_TEST' });
        return true;
    } catch (err) {
        logger.error(`Critical error connecting to Supabase: ${err.message}`, { phase: 'DB_TEST' });
        return false;
    }
}

export default supabase;
