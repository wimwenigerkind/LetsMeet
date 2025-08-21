const fs = require('fs');
const { Pool } = require('pg');

// Create a new PostgreSQL connection pool
const pgPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'user',
    password: 'secret',
    database: 'lf8_lets_meet_db'
});

async function main() {
    console.log('Migrating database...');

    try {
        // Connect to the PostgreSQL database
        const client = await pgPool.connect();
        console.log('Connected to PostgreSQL database');
        client.release();

        // Run create table migration
        await executeSQLFile('create_tables.sql');
        console.log("Created tables successfully");

    } catch (error) {
        console.error('Error while migrating to PostgreSQL database:', error);
    } finally {
        await pgPool.end();
    }
}

async function executeSQLFile(filename) {
    try {
        const sqlContent = fs.readFileSync(filename, 'utf8');
        await pgPool.query(sqlContent);
    } catch (error) {
        throw new Error(`Failed to execute SQL file ${filename}: ${error.message}`);
    }
}

// Run the migration
if (require.main === module) {
    main();
}