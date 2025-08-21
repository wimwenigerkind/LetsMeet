const express = require('express');
const pool = require('../config/database');
const router = express.Router();

// Get likes for a user (who they liked)
router.get('/user/:userId/given', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const query = `
      SELECT 
        l.id as like_id,
        l.created_at as liked_at,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.gender,
        u.birth_date,
        a.city,
        -- Check if it's mutual
        CASE WHEN mutual.id IS NOT NULL THEN true ELSE false END as is_mutual
      FROM likes l
      JOIN users u ON l.liked_user_id = u.id
      LEFT JOIN addresses a ON u.id = a.user_id
      LEFT JOIN likes mutual ON mutual.liker_user_id = l.liked_user_id 
                           AND mutual.liked_user_id = l.liker_user_id
      WHERE l.liker_user_id = $1
      ORDER BY l.created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching given likes:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get likes received by a user
router.get('/user/:userId/received', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const query = `
      SELECT 
        l.id as like_id,
        l.created_at as liked_at,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.gender,
        u.birth_date,
        a.city,
        -- Check if it's mutual
        CASE WHEN mutual.id IS NOT NULL THEN true ELSE false END as is_mutual
      FROM likes l
      JOIN users u ON l.liker_user_id = u.id
      LEFT JOIN addresses a ON u.id = a.user_id
      LEFT JOIN likes mutual ON mutual.liker_user_id = l.liked_user_id 
                           AND mutual.liked_user_id = l.liker_user_id
      WHERE l.liked_user_id = $1
      ORDER BY l.created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching received likes:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Like a user
router.post('/', async (req, res) => {
  try {
    const { liker_user_id, liked_user_id } = req.body;
    
    if (!liker_user_id || !liked_user_id) {
      return res.status(400).json({
        success: false,
        message: 'Both liker_user_id and liked_user_id are required'
      });
    }
    
    if (liker_user_id === liked_user_id) {
      return res.status(400).json({
        success: false,
        message: 'Users cannot like themselves'
      });
    }
    
    // Check if both users exist
    const usersExist = await pool.query(
      'SELECT id FROM users WHERE id IN ($1, $2)',
      [liker_user_id, liked_user_id]
    );
    
    if (usersExist.rows.length !== 2) {
      return res.status(404).json({
        success: false,
        message: 'One or both users not found'
      });
    }
    
    // Check if like already exists
    const existingLike = await pool.query(`
      SELECT id FROM likes 
      WHERE liker_user_id = $1 AND liked_user_id = $2
    `, [liker_user_id, liked_user_id]);
    
    if (existingLike.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Like already exists'
      });
    }
    
    // Create the like
    const query = `
      INSERT INTO likes (liker_user_id, liked_user_id)
      VALUES ($1, $2)
      RETURNING *
    `;
    
    const result = await pool.query(query, [liker_user_id, liked_user_id]);
    
    // Check if it creates a mutual like (match)
    const mutualLike = await pool.query(`
      SELECT id FROM likes 
      WHERE liker_user_id = $2 AND liked_user_id = $1
    `, [liker_user_id, liked_user_id]);
    
    const isMatch = mutualLike.rows.length > 0;
    
    res.status(201).json({
      success: true,
      message: isMatch ? 'It\'s a match!' : 'Like created successfully',
      data: {
        ...result.rows[0],
        is_match: isMatch
      }
    });
  } catch (error) {
    console.error('Error creating like:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Remove a like
router.delete('/:likeId', async (req, res) => {
  try {
    const likeId = req.params.likeId;
    
    const result = await pool.query(
      'DELETE FROM likes WHERE id = $1 RETURNING *',
      [likeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Like not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Like removed successfully'
    });
  } catch (error) {
    console.error('Error removing like:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get mutual likes (matches) for a user
router.get('/user/:userId/matches', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const query = `
      SELECT DISTINCT
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.gender,
        u.birth_date,
        a.city,
        l1.created_at as first_like_date,
        l2.created_at as match_date
      FROM likes l1
      JOIN likes l2 ON l1.liker_user_id = l2.liked_user_id 
                   AND l1.liked_user_id = l2.liker_user_id
      JOIN users u ON (CASE WHEN l1.liker_user_id = $1 THEN l1.liked_user_id ELSE l1.liker_user_id END) = u.id
      LEFT JOIN addresses a ON u.id = a.user_id
      WHERE l1.liker_user_id = $1 OR l1.liked_user_id = $1
      ORDER BY GREATEST(l1.created_at, l2.created_at) DESC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get like statistics
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_likes,
        COUNT(DISTINCT liker_user_id) as users_giving_likes,
        COUNT(DISTINCT liked_user_id) as users_receiving_likes,
        -- Calculate matches (mutual likes)
        (SELECT COUNT(*)/2 FROM (
          SELECT l1.liker_user_id, l1.liked_user_id
          FROM likes l1
          JOIN likes l2 ON l1.liker_user_id = l2.liked_user_id 
                       AND l1.liked_user_id = l2.liker_user_id
        ) matches) as total_matches
      FROM likes
    `;
    
    const result = await pool.query(statsQuery);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching like stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;