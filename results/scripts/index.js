import fs from 'fs';
import pkg from "pg";
import {MongoClient} from "mongodb";
const { Client } = pkg;

const sql = fs.readFileSync("create_tables.sql", "utf8");

const pgClient = new Client({
    user: "user",
    host: "localhost",
    database: "lf8_letsmeet_db",
    password: "secret",
    port: 5432,
})

async function main() {
    console.log("starting...");

    const emailToUserID = new Map();

    try {
        const client = await pgClient.connect();
        console.log("Connected!");
        client.release();

        console.log("MongoDB daten importieren...");
        await importMongoData(emailToUserID);
        console.log("import erfolgreich")
    }catch(err) {
        console.log(err);
    }finally {
        await pgClient.end();
    }

}

async function importMongoData(emailToUserID) {
    let mongoClient;
    try {
        mongoClient = new MongoClient("mongodb://localhost:27017");
        await mongoClient.connect();

        const db = mongoClient.db("LetsMeet");
        const collection = await db.collection("users");

        const users = await collection.find({}).toArray();

        for(const mongoUser of users){
            const userID = emailToUserID.get(mongoUser._id);

            if(!userID){
                console.log("MongoDB user doesn't exist");
                continue;
            }

            //likes
            if(mongoUser.likes){
                for(const like of mongoUser.likes){
                    const likeduserID = emailToUserID.get(like.liked_email);
                    if(!likeduserID){continue;}
                    const timestamp = new Date(like.timestamp);

                    //insert von like in die DB mit allen zugehörigen daten von like
                    await insertLike(userID, likeduserID,like.status, timestamp)
                }
            }

            if(mongoUser.messages){
                for(const message of mongoUser.messages){
                    const receiverID = emailToUserID.get(message.receiver_email);
                    if(!receiverID)continue;

                    await conversationExist(message.conversationId);

                    const timestamp = new Date(message.timestamp);

                    await insertMessage(message.conversationId, userID,receiverID,message.message,timestamp);
                }
            }

            //friendships
            if(mongoUser.friends){

                // warum über email und nicht user id??
                for (const friendEmail of mongoUser.friends){
                    const friendUserId = emailToUserID.get(friendEmail);
                    if(!friendUserId)continue;
                    const createdAt = mongoUser.createdAt || new Date();

                    await insertFriendship(userID, friendUserId, "accepted", createdAt);
                }
            }
        }

    }catch(err) {
        console.log(err);
    }finally {
        if(mongoClient) {
            await mongoClient.close();
        }
    }
}

async function insertLike(liker_user_id, liked_user_id,status, timestamp) {
    await pgClient.query(
        "INSERT INTO likes (liker_user_id,liked_user_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (liker_user_id, liked_user_id) DO NOTHING"
        , [liker_user_id, liked_user_id, status, timestamp, timestamp]);
}

async function conversationExist(conversationID){
    await pgClient.query(`
    INSERT INTO messages (conversation_id, sender_user_id, message_text, sent_at)
    VALUES ($1, $2, $3, $4)
  `, [conversationID, senderUserID, messageText, sentAt]);
}

async function insertFriendship(userID1, userID2, status, createdAt) {
    await pgClient.query(`
    INSERT INTO friendships (user_id_1, user_id_2, status, created_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id_1, user_id_2) DO NOTHING
  `, [userID1, userID2, status, createdAt]);
}

if(require.main === module){
    main();
}

module.exports = {main, importMongoData};