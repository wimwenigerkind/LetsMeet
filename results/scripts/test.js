import pgClient from "./db.js";

async function runTests() {
    let allGood  = true;
    try {
        const tables = [
            "users",
            "addresses",
            "hobbies",
            "friendships",
            "likes",
            "conversations",
            "conversations_users",
            "messages",
            "user_photos",
        ];

        let existCount = 0;

        for (const table of tables) {
            const res = await pgClient.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND lower(table_name) = '${table}'
                ) AS exists;
            `);

            if (res.rows[0].exists) {
                console.log(`✅ Tabelle '${table}' existiert!`);
                existCount++;
            } else {
                console.warn(`❌ Tabelle '${table}' fehlt!`);
            }
        }

        console.log(`\n📊 Ergebnis: ${existCount} von ${tables.length} Tabellen existieren.\n`);


        const res = await pgClient.query(`
            SELECT COUNT(email) AS total, COUNT(DISTINCT email) AS unique
            FROM users;
        `);

        if (Number(res.rows[0].total) === Number(res.rows[0].unique)) {
            console.log("✅ Users: Alle Emails sind einzigartig.");
        } else {
            console.warn("❌ Users: Duplicate Emails gefunden!");
            allGood = false;
        }


        const res2 = await pgClient.query(`
            SELECT COUNT(*) AS invalid 
            FROM friendships 
            WHERE user_id_1 = user_id_2;
        `);

        if (Number(res2.rows[0].invalid) === 0) {
            console.log("✅ Friendships: Keine Self-Friendships vorhanden.");
        } else {
            console.warn(`❌ Friendships: ${res2.rows[0].invalid} Self-Friendships gefunden!`);
            allGood = false;
        }

        const res4 = await pgClient.query(`
            SELECT user_id, COUNT(*) AS profiles
            FROM user_photos
            WHERE is_profile_picture = true
            GROUP BY user_id
            HAVING COUNT(*) > 1;
        `);

        if (res4.rowCount === 0) {
            console.log("✅ User_Photos: max. ein Profilbild pro User.");
        } else {
            console.warn(`❌ User_Photos: ${res4.rowCount} User haben mehrere Profilbilder.`);
            allGood = false;
        }


        const res5 = await pgClient.query(`
            SELECT COUNT(*) AS invalid 
            FROM messages 
            WHERE message_text IS NULL OR trim(message_text) = '';
        `);

        if (Number(res5.rows[0].invalid) === 0) {
            console.log("✅ Messages: Keine leeren Nachrichten vorhanden.");
        } else {
            console.warn(`❌ Messages: ${res5.rows[0].invalid} leere Nachrichten gefunden.`);
            allGood = false;
        }


        if (allGood) {
            console.log("\n🎉 Alle Tests erfolgreich!");
        } else {
            console.log("\n⚠️  Mindestens ein Test ist fehlgeschlagen!");
        }

    } catch (error) {
        console.error("❌ Fehler beim Test:", error);
    } finally {
        await pgClient.end();
    }
}

runTests();
