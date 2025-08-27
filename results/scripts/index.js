// index.js
import importMongoData from "./importMongo.js";
// import importExcelData from "./importExcel.js";   // kannst du später ergänzen
// import importXmlData from "./importXml.js";       // kannst du später ergänzen
import pgClient from "./db.js";

async function main() {
    console.log("🚀 Starting full import...");

    try {
        // Schritt 1: MongoDB
        console.log("📥 Importing MongoDB data...");
        await importMongoData();

        // Schritt 2: Excel
        // console.log("📥 Importing Excel data...");
        // await importExcelData();

        // Schritt 3: XML
        // console.log("📥 Importing XML data...");
        // await importXmlData();

        console.log("✅ Full import finished successfully");
    } catch (err) {
        console.error("❌ Import failed:", err);
    } finally {
        await pgClient.end();
        console.log("🔒 Postgres connection closed");
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
