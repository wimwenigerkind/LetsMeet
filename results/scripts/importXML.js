import fs from "fs";
import path from "path";
import { parseStringPromise } from "xml2js";
import pgClient from "./db.js";

// __dirname für ES Modules
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importXmlData() {
    // Pfad zur XML-Datei im Projekt-Root
    const xmlFilePath = path.join(__dirname, "../../lets_meet_hobbies.xml");

    if (!fs.existsSync(xmlFilePath)) {
        throw new Error(`XML file not found: ${xmlFilePath}`);
    }

    const xmlData = fs.readFileSync(xmlFilePath, "utf-8");
    const result = await parseStringPromise(xmlData);

    const users = Array.isArray(result.users.user) ? result.users.user : [result.users.user];
    let hobbyCount = 0;

    for (const u of users) {
        const email = u.email?.[0];
        const hobbies = u.hobbies?.[0]?.hobby || [];

        if (!email) {
            console.warn("User without email, skipping");
            continue;
        }

        // UserId aus der DB abrufen
        const userRes = await pgClient.query(
            `SELECT id FROM users WHERE email = $1`,
            [email]
        );

        if (userRes.rows.length === 0) {
            console.log(`⚠️ User not found for email: ${email}, skipping hobbies`);
            continue;
        }

        const userId = userRes.rows[0].id;

        // Hobbies einfügen
        for (const h of hobbies) {
            const hobbyName = Array.isArray(h) ? h[0] : h;

            if (!hobbyName) continue; // leere Hobbies überspringen

            try {
                await pgClient.query(
                    `INSERT INTO hobbies (user_id, name)
                     VALUES ($1, $2)
                         ON CONFLICT (user_id, name) DO NOTHING`,
                    [userId, hobbyName]
                );
                if (res.rowCount > 0) {
                    console.log(`🔄 Updated or inserted hobby '${hobbyName}' for user ID ${userId}`);
                }
                hobbyCount++;
            } catch (err) {
                console.error(`❌ Failed to insert hobby ${hobbyName} for user ${email}:`, err.message);
            }
        }
    }

    console.log(`✅ Imported ${hobbyCount} hobbies from XML`);
}

// Direkt ausführbar
if (import.meta.url === `file://${process.argv[1]}`) {
    importXmlData()
        .then(() => pgClient.end())
        .catch(err => {
            console.error(err);
            pgClient.end();
        });
}

export default importXmlData;