const { Pool } = require('pg');

// Create a new PostgreSQL connection pool
const pgPool = new Pool({
    host: 'localhost',
    port: 5433,
    user: 'user',
    password: 'secret',
    database: 'lf8_lets_meet_db'
});

async function main() {
    console.log('Migrating database...');

    // Connect to the PostgreSQL database
    try {
        await pgPool.connect();
        console.log('Connected to PostgreSQL database');
    } catch (error) {
        console.error('Error connecting to PostgreSQL database:', error);
        return;
    }
}

// Run the migration
if (require.main === module) {
    main();
}