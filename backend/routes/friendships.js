const express = require('express');
const pool = require('../config/database');
const { validateRequest, schemas } = require('../middleware/validation');
const router = express.Router();

// Get all friendships for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { status } = req.query;
    
    let query = `
      SELECT 
        f.id as friendship_id,
        f.status,
        f.created_at,
        CASE 
          WHEN f.user_id_1 = $1 THEN u2.id 
          ELSE u1.id 
        END as friend_id,
        CASE 
          WHEN f.user_id_1 = $1 THEN u2.first_name 
          ELSE u1.first_name 
        END as friend_first_name,
        CASE 
          WHEN f.user_id_1 = $1 THEN u2.last_name 
          ELSE u1.last_name 
        END as friend_last_name,
        CASE 
          WHEN f.user_id_1 = $1 THEN u2.gender 
          ELSE u1.gender 
        END as friend_gender,
        CASE 
          WHEN f.user_id_1 = $1 THEN a2.city 
          ELSE a1.city 
        END as friend_city
      FROM friendships f
      JOIN users u1 ON f.user_id_1 = u1.id
      JOIN users u2 ON f.user_id_2 = u2.id
      LEFT JOIN addresses a1 ON u1.id = a1.user_id
      LEFT JOIN addresses a2 ON u2.id = a2.user_id
      WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1)
    `;
    
    const values = [userId];
    
    if (status) {
      query += ` AND f.status = $2`;
      values.push(status);
    }
    
    query += ` ORDER BY f.created_at DESC`;
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching friendships:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send friend request
router.post('/user/:userId/request', validateRequest(schemas.createFriendship), async (req, res) => {
  try {
    const userId1 = req.params.userId;
    const { user_id_2 } = req.body;
    
    // Check if both users exist
    const usersExist = await pool.query(
      'SELECT id FROM users WHERE id IN ($1, $2)',
      [userId1, user_id_2]
    );
    
    if (usersExist.rows.length !== 2) {
      return res.status(404).json({
        success: false,
        message: 'One or both users not found'
      });
    }
    
    // Check if friendship already exists (in any direction)
    const existingFriendship = await pool.query(`
      SELECT id, status FROM friendships 
      WHERE (user_id_1 = $1 AND user_id_2 = $2) 
         OR (user_id_1 = $2 AND user_id_2 = $1)
    `, [userId1, user_id_2]);
    
    if (existingFriendship.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Friendship request already exists',
        current_status: existingFriendship.rows[0].status
      });
    }
    
    // Create friendship request
    const query = `
      INSERT INTO friendships (user_id_1, user_id_2, status)
      VALUES ($1, $2, 'pending')
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId1, user_id_2]);
    
    res.status(201).json({
      success: true,
      message: 'Friend request sent successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Respond to friend request (accept/reject)
router.put('/:friendshipId/status', validateRequest(schemas.updateFriendshipStatus), async (req, res) => {
  try {
    const friendshipId = req.params.friendshipId;
    const { status } = req.body;
    
    const query = `
      UPDATE friendships 
      SET status = $2
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `;
    
    const result = await pool.query(query, [friendshipId, status]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending friendship request not found'
      });
    }
    
    res.json({
      success: true,
      message: `Friend request ${status} successfully`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating friendship status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Remove friendship
router.delete('/:friendshipId', async (req, res) => {
  try {
    const friendshipId = req.params.friendshipId;
    
    const result = await pool.query(
      'DELETE FROM friendships WHERE id = $1 RETURNING id',
      [friendshipId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Friendship not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Friendship removed successfully'
    });
  } catch (error) {
    console.error('Error removing friendship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get mutual friends between two users
router.get('/mutual/:userId1/:userId2', async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    
    const query = `
      SELECT DISTINCT 
        u.id, u.first_name, u.last_name, u.gender,
        a.city
      FROM users u
      LEFT JOIN addresses a ON u.id = a.user_id
      WHERE u.id IN (
        -- Friends of user1
        SELECT CASE 
          WHEN f1.user_id_1 = $1 THEN f1.user_id_2 
          ELSE f1.user_id_1 
        END
        FROM friendships f1
        WHERE (f1.user_id_1 = $1 OR f1.user_id_2 = $1) 
          AND f1.status = 'accepted'
      ) AND u.id IN (
        -- Friends of user2
        SELECT CASE 
          WHEN f2.user_id_1 = $2 THEN f2.user_id_2 
          ELSE f2.user_id_1 
        END
        FROM friendships f2
        WHERE (f2.user_id_1 = $2 OR f2.user_id_2 = $2) 
          AND f2.status = 'accepted'
      )
      ORDER BY u.first_name, u.last_name
    `;
    
    const result = await pool.query(query, [userId1, userId2]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching mutual friends:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get friend suggestions based on mutual friends and hobbies
router.get('/suggestions/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { limit = 10 } = req.query;
    
    const query = `
      WITH user_friends AS (
        SELECT CASE 
          WHEN f.user_id_1 = $1 THEN f.user_id_2 
          ELSE f.user_id_1 
        END as friend_id
        FROM friendships f
        WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1) 
          AND f.status = 'accepted'
      ),
      user_hobbies AS (
        SELECT name FROM hobbies WHERE user_id = $1 AND rating > 50
      ),
      suggestions AS (
        SELECT DISTINCT 
          u.id, u.first_name, u.last_name, u.gender, u.birth_date,
          a.city,
          -- Count mutual friends
          (SELECT COUNT(*) 
           FROM user_friends uf 
           JOIN friendships f2 ON (
             (f2.user_id_1 = uf.friend_id AND f2.user_id_2 = u.id) OR
             (f2.user_id_2 = uf.friend_id AND f2.user_id_1 = u.id)
           )
           WHERE f2.status = 'accepted'
          ) as mutual_friends_count,
          -- Count common hobbies
          (SELECT COUNT(*) 
           FROM hobbies h 
           JOIN user_hobbies uh ON h.name = uh.name
           WHERE h.user_id = u.id AND h.rating > 50
          ) as common_hobbies_count
        FROM users u
        LEFT JOIN addresses a ON u.id = a.user_id
        WHERE u.id != $1  -- Not the user themselves
          AND u.id NOT IN (SELECT friend_id FROM user_friends)  -- Not already friends
          AND u.id NOT IN (  -- No pending requests
            SELECT user_id_2 FROM friendships 
            WHERE user_id_1 = $1 AND status = 'pending'
          )
          AND u.id NOT IN (  -- No received requests
            SELECT user_id_1 FROM friendships 
            WHERE user_id_2 = $1 AND status = 'pending'
          )
      )
      SELECT * FROM suggestions
      WHERE mutual_friends_count > 0 OR common_hobbies_count > 0
      ORDER BY mutual_friends_count DESC, common_hobbies_count DESC, first_name
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limit]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching friend suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;