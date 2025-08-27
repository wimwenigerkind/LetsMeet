// index.js
import createTables from "./create_tables.js";
import importMongoData from "./importMongo.js";
import importExcelData from "./importExcel.js";
import importXmlData from "./importXml.js";       // kannst du später ergänzen
import pgClient from "./db.js";

async function main() {
    console.log("🚀 Starting full data migration process...");

    try {
        // Schritt 1: Create database tables
        await createTables();
        
        // Schritt 2: MongoDB import
        console.log("📥 Importing MongoDB data...");
        await importMongoData();

        // Schritt 3: Excel import
        console.log("📊 Importing Excel data...");
        await importExcelData();

        // Schritt 4: XML (future)
        console.log("📥 Importing XML data...");
        await importXmlData();

        console.log("✅ Full migration process completed successfully");
    } catch (err) {
        console.error("❌ Migration process failed:", err.message);
        process.exit(1);
    } finally {
        await pgClient.end();
        console.log("🔒 Postgres connection closed");
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
