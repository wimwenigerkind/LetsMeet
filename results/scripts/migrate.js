const fs = require('fs');
const xlsx = require('xlsx');
const xml2js = require('xml2js');
const { MongoClient } = require('mongodb');
const { Pool } = require('pg');

// PostgreSQL connection
const pgPool = new Pool({
  host: 'localhost',
  port: 5433,
  user: 'user',
  password: 'secret',
  database: 'lf8_lets_meet_db'
});

async function main() {
  console.log('🚀 Starting Let\'s Meet Data Import...');
  
  const emailToUserID = new Map();
  
  try {
    // Test PostgreSQL connection
    const client = await pgPool.connect();
    console.log('✅ Connected to PostgreSQL');
    client.release();
    
    // Execute CREATE TABLE script
    await executeSQLFile('create_tables.sql');
    console.log('✅ Database tables created');
    
    // 1. Import Excel data
    console.log('📊 Importing Excel data...');
    await importExcelData(emailToUserID);
    console.log('✅ Excel data imported');
    
    // 2. Import XML data  
    console.log('📄 Importing XML data...');
    await importXMLData(emailToUserID);
    console.log('✅ XML data imported');
    
    // 3. Import MongoDB data
    console.log('🍃 Importing MongoDB data...');
    await importMongoData(emailToUserID);
    console.log('✅ MongoDB data imported');
    
    // Print summary
    await printImportSummary();
    console.log('🎉 Import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await pgPool.end();
  }
}

async function executeSQLFile(filename) {
  try {
    const sqlContent = fs.readFileSync(filename, 'utf8');
    await pgPool.query(sqlContent);
  } catch (error) {
    throw new Error(`Failed to execute SQL file ${filename}: ${error.message}`);
  }
}

async function importExcelData(emailToUserID) {
  try {
    const workbook = xlsx.readFile('../../Lets Meet DB Dump.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Skip header row if exists
    const startRow = data.length > 0 && data[0][0].includes('Nachname') ? 1 : 0;
    
    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 8) {
        continue; // Skip incomplete rows
      }
      
      try {
        const { user, address, hobbies } = parseExcelRow(row);
        
        // Insert user
        const userResult = await pgPool.query(`
          INSERT INTO users (email, first_name, last_name, phone_number, gender, preferred_gender, birth_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [user.email, user.firstName, user.lastName, user.phoneNumber, user.gender, user.preferredGender, user.birthDate]);
        
        const userID = userResult.rows[0].id;
        emailToUserID.set(user.email, userID);
        
        // Insert address
        if (address.street) {
          await insertAddress(userID, address);
        }
        
        // Insert hobbies
        for (const hobby of hobbies) {
          await insertHobby(userID, hobby.name, hobby.rating);
        }
        
      } catch (error) {
        console.log(`⚠️  Skipping row ${i + 1}: ${error.message}`);
      }
    }
  } catch (error) {
    throw new Error(`Failed to import Excel data: ${error.message}`);
  }
}

function parseExcelRow(row) {
  const user = {};
  const address = {};
  const hobbies = [];
  
  // Parse name (Column 0: "Nachname, Vorname")
  const nameParts = row[0].split(',');
  if (nameParts.length >= 2) {
    user.lastName = nameParts[0].trim();
    user.firstName = nameParts[1].trim();
  }
  
  // Parse address (Column 1: "Straße Nr, PLZ, Ort")
  const addressParts = row[1].split(',');
  if (addressParts.length >= 3) {
    const streetParts = addressParts[0].trim().split(' ');
    if (streetParts.length >= 2) {
      address.street = streetParts.slice(0, -1).join(' ');
      address.houseNumber = streetParts[streetParts.length - 1];
    }
    address.postalCode = addressParts[1].trim();
    address.city = addressParts[2].trim();
    address.isPrimary = true;
  }
  
  // Parse phone (Column 2)
  user.phoneNumber = row[2]?.trim() || '';
  
  // Parse hobbies (Column 3: "Hobby1 %Prio1%; Hobby2 %Prio2%")
  const hobbiesText = row[3] || '';
  const hobbyParts = hobbiesText.split(';');
  for (const hobbyPart of hobbyParts) {
    const trimmed = hobbyPart.trim();
    if (!trimmed) continue;
    
    const match = trimmed.match(/^(.+?)\s*%(\d+)%/);
    if (match) {
      const hobbyName = match[1].trim();
      const priority = parseInt(match[2]) || 50;
      hobbies.push({ name: hobbyName, rating: priority });
    } else if (trimmed) {
      hobbies.push({ name: trimmed, rating: 50 });
    }
  }
  
  // Parse email (Column 4)
  user.email = row[4]?.trim() || '';
  
  // Parse gender (Column 5)
  user.gender = row[5]?.trim() || '';
  
  // Parse preferred gender (Column 6)
  user.preferredGender = row[6]?.trim() || '';
  
  // Parse birth date (Column 7: "DD.MM.YYYY")
  const birthStr = row[7]?.trim();
  if (birthStr) {
    const parts = birthStr.split('.');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      user.birthDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    }
  }
  
  return { user, address, hobbies };
}

async function importXMLData(emailToUserID) {
  try {
    const xmlData = fs.readFileSync('../../Lets_Meet_Hobbies.xml', 'utf8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlData);
    
    const users = result.users.user;
    
    for (const xmlUser of users) {
      const email = xmlUser.email[0];
      const userID = emailToUserID.get(email);
      
      if (!userID) {
        console.log(`⚠️  User not found for email ${email}, skipping XML hobbies`);
        continue;
      }
      
      // Insert hobbies from XML
      if (xmlUser.hobbies && xmlUser.hobbies[0] && xmlUser.hobbies[0].hobby) {
        const hobbies = xmlUser.hobbies[0].hobby;
        for (const hobbyName of hobbies) {
          await insertHobby(userID, hobbyName.trim(), 50); // Default rating
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to import XML data: ${error.message}`);
  }
}

async function importMongoData(emailToUserID) {
  let mongoClient;
  try {
    mongoClient = new MongoClient('mongodb://localhost:27017');
    await mongoClient.connect();
    
    const db = mongoClient.db('LetsMeet');
    const collection = db.collection('users');
    
    const users = await collection.find({}).toArray();
    
    for (const mongoUser of users) {
      const userID = emailToUserID.get(mongoUser._id);
      if (!userID) {
        console.log(`⚠️  User not found for email ${mongoUser._id}, skipping MongoDB data`);
        continue;
      }
      
      // Import likes
      if (mongoUser.likes) {
        for (const like of mongoUser.likes) {
          const likedUserID = emailToUserID.get(like.liked_email);
          if (!likedUserID) continue;
          
          const timestamp = new Date(like.timestamp);
          await insertLike(userID, likedUserID, like.status, timestamp);
        }
      }
      
      // Import messages
      if (mongoUser.messages) {
        for (const message of mongoUser.messages) {
          const receiverID = emailToUserID.get(message.receiver_email);
          if (!receiverID) continue;
          
          // Ensure conversation exists
          await ensureConversation(message.conversation_id);
          
          const timestamp = new Date(message.timestamp);
          await insertMessage(message.conversation_id, userID, receiverID, message.message, timestamp);
        }
      }
      
      // Import friendships
      if (mongoUser.friends) {
        for (const friendEmail of mongoUser.friends) {
          const friendUserID = emailToUserID.get(friendEmail);
          if (!friendUserID) continue;
          
          const createdAt = mongoUser.createdAt || new Date();
          await insertFriendship(userID, friendUserID, 'accepted', createdAt);
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to import MongoDB data: ${error.message}`);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

// Database insert helper functions
async function insertAddress(userID, address) {
  await pgPool.query(`
    INSERT INTO addresses (user_id, street, house_number, postal_code, city, is_primary)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [userID, address.street, address.houseNumber, address.postalCode, address.city, address.isPrimary]);
}

async function insertHobby(userID, name, rating) {
  await pgPool.query(`
    INSERT INTO hobbies (user_id, name, rating)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
  `, [userID, name, rating]);
}

async function insertLike(likerUserID, likedUserID, status, timestamp) {
  await pgPool.query(`
    INSERT INTO likes (liker_user_id, liked_user_id, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (liker_user_id, liked_user_id) DO NOTHING
  `, [likerUserID, likedUserID, status, timestamp, timestamp]);
}

async function ensureConversation(conversationID) {
  await pgPool.query(`
    INSERT INTO conversations (id)
    VALUES ($1)
    ON CONFLICT (id) DO NOTHING
  `, [conversationID]);
}

async function insertMessage(conversationID, senderUserID, receiverUserID, messageText, sentAt) {
  await pgPool.query(`
    INSERT INTO messages (conversation_id, sender_user_id, message_text, sent_at)
    VALUES ($1, $2, $3, $4)
  `, [conversationID, senderUserID, messageText, sentAt]);
}

async function insertFriendship(userID1, userID2, status, createdAt) {
  await pgPool.query(`
    INSERT INTO friendships (user_id_1, user_id_2, status, created_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id_1, user_id_2) DO NOTHING
  `, [userID1, userID2, status, createdAt]);
}

async function printImportSummary() {
  const queries = [
    { table: 'users', query: 'SELECT COUNT(*) FROM users' },
    { table: 'addresses', query: 'SELECT COUNT(*) FROM addresses' },
    { table: 'hobbies', query: 'SELECT COUNT(*) FROM hobbies' },
    { table: 'likes', query: 'SELECT COUNT(*) FROM likes' },
    { table: 'messages', query: 'SELECT COUNT(*) FROM messages' },
    { table: 'friendships', query: 'SELECT COUNT(*) FROM friendships' }
  ];

  console.log('\\n📊 Import Summary:');
  console.log('==================');
  
  for (const q of queries) {
    try {
      const result = await pgPool.query(q.query);
      const count = result.rows[0].count;
      console.log(`${q.table.charAt(0).toUpperCase() + q.table.slice(1)}: ${count} records`);
    } catch (error) {
      console.log(`Failed to get count for ${q.table}: ${error.message}`);
    }
  }
}

// Run the migration
if (require.main === module) {
  main();
}

module.exports = { main, importExcelData, importXMLData, importMongoData };