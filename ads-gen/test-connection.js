import { testConnection } from './src/db/supabase.js';
import { logger } from './src/utils/logger.js';

async function run() {
    logger.info("Initializing AdsGen Automation Backend Test...", { phase: "STARTUP" });

    const connected = await testConnection();

    if (connected) {
        logger.info("All systems go. Backend is ready to process.", { phase: "STARTUP_SUCCESS" });
        process.exit(0);
    } else {
        logger.error("Failed to connect to the Database.", { phase: "STARTUP_FAIL" });
        process.exit(1);
    }
}

run();
