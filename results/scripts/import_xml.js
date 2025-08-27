// importXml.js
import fs from "fs";
import path from "path";
import { parseStringPromise } from "xml2js";
import pgClient from "./db.js";

async function importXmlData() {
    const xmlFilePath = path.resolve("../../Lets_Meet_Hobbies.xml");

    if (!fs.existsSync(xmlFilePath)) {
        throw new Error(`XML file not found: ${xmlFilePath}`);
    }

    const xmlData = fs.readFileSync(xmlFilePath, "utf-8");
    const result = await parseStringPromise(xmlData);

    const users = Array.isArray(result.users.user) ? result.users.user : [result.users.user];
    let hobbyCount = 0;

    for (const u of users) {
        const email = u.email[0];
        const fullName = u.name[0];
        const hobbies = u.hobbies?.[0]?.hobby || [];

        // userId abrufen
        const userRes = await pgClient.query(
            `SELECT id FROM users WHERE email = $1`,
            [email]
        );
        if (userRes.rows.length === 0) continue;

        const userId = userRes.rows[0].id;

        // Hobbies einfügen
        for (const hobby of hobbies) {
            try {
                await pgClient.query(
                    `INSERT INTO hobbies (user_id, name)
                     VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`, // funktioniert ohne Unique-Constraint
                    [userId, hobby]
                );
                hobbyCount++;
            } catch (err) {
                console.error(`Failed to insert hobby "${hobby}" for user ${email}: ${err.message}`);
            }
        }
    }

    console.log(`✅ Imported ${hobbyCount} hobbies from XML`);
}

export default importXmlData;
