import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pgClient from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createTables() {
    console.log('🗄️ Creating database tables...');
    
    const sqlPath = join(__dirname, 'create_tables.sql');
    
    try {
        const sqlContent = readFileSync(sqlPath, 'utf8');
        
        // Execute the SQL content
        await pgClient.query(sqlContent);
        
        console.log('✅ Database tables created successfully');
    } catch (error) {
        console.error('❌ Failed to create tables:', error.message);
        throw error;
    }
}

// Export the function for use in index.js
export default createTables;

// Allow running this script directly
if (import.meta.url === `file://${process.argv[1]}`) {
    createTables()
        .then(() => {
            console.log('✅ Table creation completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Table creation failed:', error.message);
            process.exit(1);
        });
}