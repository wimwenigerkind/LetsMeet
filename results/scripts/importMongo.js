import { MongoClient } from "mongodb";
import pgClient from "./db.js";

function splitName(fullName) {
    if (!fullName) return { first: "", last: "" };
    // deine Mongo-Namen sind im Format "Nachname, Vorname"
    const parts = fullName.split(",");
    if (parts.length === 2) {
        return { first: parts[1].trim(), last: parts[0].trim() };
    }
    // fallback: ganzer Name als first_name
    return { first: fullName.trim(), last: "" };
}

async function insertUser(email, fullName, phone, createdAt, updatedAt) {
    const { first, last } = splitName(fullName);
    const res = await pgClient.query(
        `INSERT INTO users (email, first_name, last_name, phone_number, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE 
       SET first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           phone_number = EXCLUDED.phone_number,
           updated_at = EXCLUDED.updated_at
     RETURNING id`,
        [email, first, last, phone, createdAt, updatedAt]
    );
    return res.rows[0].id;
}

/**
 * Insert a like relation.
 */
async function insertLike(likerId, likedId, status, timestamp) {
    await pgClient.query(
        `INSERT INTO likes (liker_user_id, liked_user_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (liker_user_id, liked_user_id) DO NOTHING`,
        [likerId, likedId, status, timestamp, timestamp]
    );
}

/**
 * Ensure a conversation exists and both users are linked to it.
 */
async function ensureConversation(conversationId, userId, receiverId) {
    // check ob Conversation existiert
    const res = await pgClient.query(
        `SELECT id FROM conversations WHERE id = $1`,
        [conversationId]
    );

    let convId = conversationId;

    if (res.rows.length === 0) {
        const ins = await pgClient.query(
            `INSERT INTO conversations (id, created_at) VALUES ($1, now()) RETURNING id`,
            [conversationId]
        );
        convId = ins.rows[0].id;
    }

    // beide Nutzer in conversations_users eintragen
    await pgClient.query(
        `INSERT INTO conversations_users (conversation_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
        [convId, userId]
    );

    await pgClient.query(
        `INSERT INTO conversations_users (conversation_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
        [convId, receiverId]
    );

    return convId;
}

/**
 * Insert a message.
 */
async function insertMessage(conversationId, senderId, messageText, sentAt) {
    await pgClient.query(
        `INSERT INTO messages (conversation_id, sender_user_id, message_text, sent_at)
     VALUES ($1, $2, $3, $4)`,
        [conversationId, senderId, messageText, sentAt]
    );
}

/**
 * Insert a friendship.
 */
async function insertFriendship(userId1, userId2, status, createdAt) {
    await pgClient.query(
        `INSERT INTO friendships (user_id_1, user_id_2, status, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id_1, user_id_2) DO NOTHING`,
        [userId1, userId2, status, createdAt]
    );
}

/**
 * Import all Mongo data into Postgres.
 */
async function importMongoData() {
    const emailToUserID = new Map();
    const mongoClient = new MongoClient("mongodb://localhost:27017");

    try {
        await mongoClient.connect();
        const db = mongoClient.db("LetsMeet");
        const collection = db.collection("users");
        const users = await collection.find({}).toArray();

        // 1. Alle Users übernehmen
        for (const u of users) {
            const id = await insertUser(
                u._id,              // email als ID
                u.name,
                u.phone || null,
                u.createdAt || new Date(),
                u.updatedAt || new Date()
            );
            emailToUserID.set(u._id, id);
        }

        // 2. Beziehungen, Likes, Messages, Friends
        for (const u of users) {
            const userId = emailToUserID.get(u._id);
            if (!userId) continue;

            // Likes
            if (u.likes) {
                for (const like of u.likes) {
                    const likedId = emailToUserID.get(like.liked_email);
                    if (!likedId) continue;
                    const ts = new Date(like.timestamp);
                    await insertLike(userId, likedId, like.status, ts);
                }
            }

            // Messages
            if (u.messages) {
                for (const msg of u.messages) {
                    const receiverId = emailToUserID.get(msg.receiver_email);
                    if (!receiverId) continue;

                    const convId = await ensureConversation(
                        msg.conversation_id,
                        userId,
                        receiverId
                    );

                    await insertMessage(
                        convId,
                        userId,
                        msg.message,
                        new Date(msg.timestamp)
                    );
                }
            }

            // Friendships
            if (u.friends) {
                for (const friendEmail of u.friends) {
                    const friendId = emailToUserID.get(friendEmail);
                    if (!friendId) continue;

                    await insertFriendship(
                        userId,
                        friendId,
                        "accepted",
                        u.createdAt || new Date()
                    );
                }
            }
        }

        console.log("✅ Mongo Import finished");
    } finally {
        await mongoClient.close();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    importMongoData().then(() => process.exit(0));
}

export default importMongoData;
