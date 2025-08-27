import assert from "assert";
import pgClient from "./db.js";

async function runTests(){
   // await client.connect();
    try {
        const tableCheck = await pgClient.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'users'
            ) AS exists;
        `);
        assert.strictEqual(tableCheck.rows[0].exists,true, "Tabelle 'users' fehlt")

        console.log("✅ Alle Tests erfolgreich!");
    }catch (error){
        console.log(error);
    }finally{
        await pgClient.end();
    }
}

runTests();