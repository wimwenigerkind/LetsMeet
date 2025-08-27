// db.js
import pkg from "pg";
const { Client } = pkg;

const pgClient = new Client({
    user: process.env.PG_USER || "user",
    host: process.env.PG_HOST || "localhost",
    database: process.env.PG_DB || "lf8_lets_meet_db",
    password: process.env.PG_PASS || "secret",
    port: process.env.PG_PORT || 5432,
});

await pgClient.connect();

console.log("✅ Connected to Postgres");

export default pgClient;
