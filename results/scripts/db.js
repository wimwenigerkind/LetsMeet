// db.js
import pkg from "pg";
import { config, validateConfig } from './config.js';

const { Client } = pkg;

// Validate configuration before connecting
if (!validateConfig()) {
    process.exit(1);
}

const pgClient = new Client(config.postgres);

try {
    await pgClient.connect();
    console.log("✅ Connected to Postgres database:", config.postgres.database);
} catch (error) {
    console.error("❌ Failed to connect to Postgres:", error.message);
    console.error("💡 Please check your database connection settings");
    process.exit(1);
}

// Handle connection errors
pgClient.on('error', (error) => {
    console.error('❌ Database connection error:', error);
});

export default pgClient;
