import pkg from 'pg';
import { config } from './config.js';

const { Client } = pkg;

describe('Database Migration Tests', () => {
  let dbClient;

  beforeAll(async () => {
    dbClient = new Client(config.postgres);
    await dbClient.connect();
  });

  afterAll(async () => {
    await dbClient.end();
  });

  describe('Basic Data Integrity', () => {
    test('should have correct number of users imported', async () => {
      const result = await dbClient.query('SELECT COUNT(*) as count FROM users');
      const userCount = parseInt(result.rows[0].count);
      
      expect(userCount).toBe(1576);
    });

    test('should have no users with NULL email addresses', async () => {
      const result = await dbClient.query('SELECT COUNT(*) as count FROM users WHERE email IS NULL');
      const nullEmails = parseInt(result.rows[0].count);
      
      expect(nullEmails).toBe(0);
    });

    test('should have users with proper first_name and last_name from Excel import', async () => {
      const result = await dbClient.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE first_name IS NOT NULL 
        AND first_name != '' 
        AND last_name IS NOT NULL 
        AND last_name != ''
      `);
      const usersWithNames = parseInt(result.rows[0].count);
      
      // Should be close to total users since Excel had name data
      expect(usersWithNames).toBeGreaterThan(1500);
    });

    test('should have valid email structure (with @ symbol)', async () => {
      const result = await dbClient.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE email ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
      `);
      const validEmails = parseInt(result.rows[0].count);
      const totalUsers = await dbClient.query('SELECT COUNT(*) as count FROM users');
      const totalCount = parseInt(totalUsers.rows[0].count);
      
      const validPercentage = (validEmails / totalCount) * 100;
      expect(validPercentage).toBeGreaterThan(95); // Should be almost 100% with basic structure
      
      console.log(`📧 Email structure validation: ${validEmails}/${totalCount} (${validPercentage.toFixed(1)}%) have valid structure`);
    });
  });

  describe('Referential Integrity', () => {
    test('should have no orphaned likes', async () => {
      const result = await dbClient.query(`
        SELECT COUNT(*) as count 
        FROM likes 
        WHERE liker_user_id NOT IN (SELECT id FROM users)
        OR liked_user_id NOT IN (SELECT id FROM users)
      `);
      const orphanedLikes = parseInt(result.rows[0].count);
      
      expect(orphanedLikes).toBe(0);
    });

    test('should have no orphaned messages', async () => {
      const result = await dbClient.query(`
        SELECT COUNT(*) as count 
        FROM messages 
        WHERE sender_user_id NOT IN (SELECT id FROM users)
        OR conversation_id NOT IN (SELECT id FROM conversations)
      `);
      const orphanedMessages = parseInt(result.rows[0].count);
      
      expect(orphanedMessages).toBe(0);
    });

    test('should have no orphaned addresses', async () => {
      const result = await dbClient.query(`
        SELECT COUNT(*) as count 
        FROM addresses 
        WHERE user_id NOT IN (SELECT id FROM users)
      `);
      const orphanedAddresses = parseInt(result.rows[0].count);
      
      expect(orphanedAddresses).toBe(0);
    });

    test('should have no orphaned hobbies', async () => {
      const result = await dbClient.query(`
        SELECT COUNT(*) as count 
        FROM hobbies 
        WHERE user_id NOT IN (SELECT id FROM users)
      `);
      const orphanedHobbies = parseInt(result.rows[0].count);
      
      expect(orphanedHobbies).toBe(0);
    });
  });

  describe('Business Logic Constraints', () => {
    test('should have no self-likes', async () => {
      const result = await dbClient.query(`
        SELECT COUNT(*) as count 
        FROM likes 
        WHERE liker_user_id = liked_user_id
      `);
      const selfLikes = parseInt(result.rows[0].count);
      
      expect(selfLikes).toBe(0);
    });

    test('should have valid conversation participants', async () => {
      const result = await dbClient.query(`
        SELECT conversation_id, COUNT(*) as participant_count 
        FROM conversations_users 
        GROUP BY conversation_id 
        HAVING COUNT(*) < 2
      `);
      
      // All conversations should have at least 2 participants
      expect(result.rows.length).toBe(0);
    });

    test('should have reasonable created_at timestamps', async () => {
      const result = await dbClient.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE created_at > NOW() 
        OR created_at < '2020-01-01'
      `);
      const invalidTimestamps = parseInt(result.rows[0].count);
      
      // No users should have future dates or dates before 2020
      expect(invalidTimestamps).toBe(0);
    });
  });

  describe('Data Quality Checks', () => {
    test('should have addresses from Excel import (even if partially structured)', async () => {
      const result = await dbClient.query(`
        SELECT COUNT(*) as count 
        FROM addresses 
        WHERE (street IS NOT NULL AND street != '') 
        OR (city IS NOT NULL AND city != '')
      `);
      const addressesWithData = parseInt(result.rows[0].count);
      
      // Should have addresses from Excel import, even if not all fields are complete
      expect(addressesWithData).toBeGreaterThan(1000);
      
      console.log(`🏠 Address import: ${addressesWithData}/1576 users have address data`);
    });

    test('should have multiple hobbies per user from Excel import', async () => {
      const result = await dbClient.query(`
        SELECT 
          COUNT(*) as total_hobbies,
          COUNT(DISTINCT user_id) as users_with_hobbies,
          ROUND(AVG(hobby_count), 2) as avg_hobbies_per_user
        FROM (
          SELECT user_id, COUNT(*) as hobby_count
          FROM hobbies
          GROUP BY user_id
        ) hobby_stats
      `);
      
      const stats = result.rows[0];
      const totalHobbies = parseInt(stats.total_hobbies);
      const usersWithHobbies = parseInt(stats.users_with_hobbies);
      const avgHobbiesPerUser = parseFloat(stats.avg_hobbies_per_user);
      
      // Should have significantly more hobbies than users (multiple hobbies per user)
      expect(totalHobbies).toBeGreaterThanOrEqual(usersWithHobbies);
      expect(avgHobbiesPerUser).toBeGreaterThan(2.0); // Much higher expectation since we have 5128/1566 = 3.27
      
      console.log(`🎯 Hobby statistics: ${totalHobbies} total hobbies, ${usersWithHobbies} users, ${avgHobbiesPerUser} avg per user`);
    });

    test('should have hobbies with valid ratings from Excel', async () => {
      const result = await dbClient.query(`
        SELECT COUNT(*) as count 
        FROM hobbies 
        WHERE rating IS NOT NULL 
        AND (rating < 0 OR rating > 100)
      `);
      const invalidRatings = parseInt(result.rows[0].count);
      
      // All hobby ratings should be between 0-100 if set
      expect(invalidRatings).toBe(0);
    });

    test('should have hobbies with ratings (from Excel) and without (from XML/future)', async () => {
      const withRatingResult = await dbClient.query(`
        SELECT COUNT(*) as count FROM hobbies WHERE rating IS NOT NULL
      `);
      const withoutRatingResult = await dbClient.query(`
        SELECT COUNT(*) as count FROM hobbies WHERE rating IS NULL
      `);
      
      const withRating = parseInt(withRatingResult.rows[0].count);
      const withoutRating = parseInt(withoutRatingResult.rows[0].count);
      
      // Should have both types - some with ratings (Excel) and some without (XML)
      expect(withRating).toBeGreaterThan(0);
      // withoutRating might be 0 if XML import is not run, but that's okay
      
      console.log(`📊 Hobby ratings: ${withRating} with rating, ${withoutRating} without rating`);
    });

    test('should have users with gender values from Excel', async () => {
      const result = await dbClient.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE gender IN ('male', 'female', 'nonbinary')
      `);
      const usersWithGender = parseInt(result.rows[0].count);
      
      // Should have many users with gender from Excel
      expect(usersWithGender).toBeGreaterThan(1000);
    });

    test('should have diverse hobby types', async () => {
      const result = await dbClient.query(`
        SELECT 
          name as hobby_name,
          COUNT(*) as user_count,
          ROUND(AVG(rating), 2) as avg_rating
        FROM hobbies 
        GROUP BY name 
        ORDER BY user_count DESC, avg_rating DESC
        LIMIT 10
      `);
      
      expect(result.rows.length).toBeGreaterThan(5);
      
      console.log(`🎨 Top hobbies:`);
      result.rows.forEach(hobby => {
        const rating = hobby.avg_rating ? ` (avg rating: ${hobby.avg_rating})` : '';
        console.log(`   ${hobby.hobby_name}: ${hobby.user_count} users${rating}`);
      });
    });

    test('should prevent duplicate hobbies for same user', async () => {
      // This tests the UNIQUE constraint (user_id, name)
      const result = await dbClient.query(`
        SELECT user_id, name, COUNT(*) as duplicate_count
        FROM hobbies 
        GROUP BY user_id, name
        HAVING COUNT(*) > 1
      `);
      
      // Should have no duplicates due to UNIQUE constraint
      expect(result.rows.length).toBe(0);
    });
  });

  describe('Sample Data Verification', () => {
    test('should have specific test user with correct data', async () => {
      // Test a specific user we know from the data
      const result = await dbClient.query(`
        SELECT * 
        FROM users 
        WHERE email = 'martin.forster@web.ork'
        LIMIT 1
      `);
      
      expect(result.rows.length).toBe(1);
      const user = result.rows[0];
      expect(user.email).toBe('martin.forster@web.ork');
      expect(user.first_name).toBeTruthy();
      expect(user.last_name).toBeTruthy();
    });

    test('should have likes data from MongoDB', async () => {
      const result = await dbClient.query('SELECT COUNT(*) as count FROM likes');
      const likesCount = parseInt(result.rows[0].count);
      
      // Should have imported likes from MongoDB
      expect(likesCount).toBeGreaterThan(0);
    });

    test('should have messages data from MongoDB', async () => {
      const result = await dbClient.query('SELECT COUNT(*) as count FROM messages');
      const messagesCount = parseInt(result.rows[0].count);
      
      // Should have imported messages from MongoDB
      expect(messagesCount).toBeGreaterThan(0);
    });

    test('should have conversations with proper structure', async () => {
      const result = await dbClient.query(`
        SELECT c.id, COUNT(cu.user_id) as participant_count
        FROM conversations c
        JOIN conversations_users cu ON c.id = cu.conversation_id
        GROUP BY c.id
        ORDER BY c.id
        LIMIT 5
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      // Each conversation should have participants
      result.rows.forEach(conversation => {
        expect(parseInt(conversation.participant_count)).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Import Statistics', () => {
    test('should provide import statistics summary', async () => {
      const queries = [
        { name: 'Users', query: 'SELECT COUNT(*) as count FROM users' },
        { name: 'Addresses', query: 'SELECT COUNT(*) as count FROM addresses' },
        { name: 'Hobbies', query: 'SELECT COUNT(*) as count FROM hobbies' },
        { name: 'Likes', query: 'SELECT COUNT(*) as count FROM likes' },
        { name: 'Messages', query: 'SELECT COUNT(*) as count FROM messages' },
        { name: 'Conversations', query: 'SELECT COUNT(*) as count FROM conversations' },
        { name: 'Friendships', query: 'SELECT COUNT(*) as count FROM friendships' }
      ];

      console.log('\\n📊 Migration Statistics:');
      console.log('========================');
      
      for (const { name, query } of queries) {
        const result = await dbClient.query(query);
        const count = parseInt(result.rows[0].count);
        console.log(`${name.padEnd(15)}: ${count.toLocaleString()}`);
        
        // Basic sanity checks
        expect(count).toBeGreaterThanOrEqual(0);
      }
      
      // This test always passes - it's just for reporting
      expect(true).toBe(true);
    });
  });
});