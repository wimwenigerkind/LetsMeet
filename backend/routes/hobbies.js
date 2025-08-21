const express = require('express');
const pool = require('../config/database');
const { validateRequest, schemas } = require('../middleware/validation');
const router = express.Router();

// Get all hobbies for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const query = `
      SELECT * FROM hobbies 
      WHERE user_id = $1 
      ORDER BY rating DESC, name ASC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching hobbies:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Add hobby for user
router.post('/user/:userId', validateRequest(schemas.createHobby), async (req, res) => {
  try {
    const userId = req.params.userId;
    const { name, rating } = req.body;
    
    // Check if user exists
    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if hobby already exists for this user
    const existingHobby = await pool.query(
      'SELECT id FROM hobbies WHERE user_id = $1 AND name = $2',
      [userId, name]
    );
    
    if (existingHobby.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Hobby already exists for this user'
      });
    }
    
    const query = `
      INSERT INTO hobbies (user_id, name, rating)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, name, rating]);
    
    res.status(201).json({
      success: true,
      message: 'Hobby added successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding hobby:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update hobby rating
router.put('/:hobbyId', validateRequest(schemas.updateHobbyRating), async (req, res) => {
  try {
    const hobbyId = req.params.hobbyId;
    const { rating } = req.body;
    
    const query = `
      UPDATE hobbies 
      SET rating = $2
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [hobbyId, rating]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hobby not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Hobby rating updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating hobby:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete hobby
router.delete('/:hobbyId', async (req, res) => {
  try {
    const hobbyId = req.params.hobbyId;
    
    const result = await pool.query('DELETE FROM hobbies WHERE id = $1 RETURNING id', [hobbyId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hobby not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Hobby deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting hobby:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get hobbies statistics
router.get('/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        name,
        COUNT(*) as user_count,
        AVG(rating) as avg_rating,
        MAX(rating) as max_rating,
        MIN(rating) as min_rating
      FROM hobbies 
      GROUP BY name 
      ORDER BY user_count DESC, avg_rating DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching hobby stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Find users by hobby interest
router.get('/interest/:hobbyName', async (req, res) => {
  try {
    const hobbyName = req.params.hobbyName;
    const { minRating = 0 } = req.query;
    
    const query = `
      SELECT u.id, u.first_name, u.last_name, u.gender, u.birth_date,
             h.rating, a.city
      FROM users u
      JOIN hobbies h ON u.id = h.user_id
      LEFT JOIN addresses a ON u.id = a.user_id
      WHERE h.name ILIKE $1 AND h.rating >= $2
      ORDER BY h.rating DESC, u.first_name ASC
    `;
    
    const result = await pool.query(query, [`%${hobbyName}%`, minRating]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error finding users by hobby:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get hobby compatibility between two users
router.get('/compatibility/:userId1/:userId2', async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    
    const query = `
      SELECT 
        h1.name as hobby,
        h1.rating as user1_rating,
        h2.rating as user2_rating,
        ABS(h1.rating - h2.rating) as rating_difference
      FROM hobbies h1
      JOIN hobbies h2 ON h1.name = h2.name
      WHERE h1.user_id = $1 AND h2.user_id = $2
      ORDER BY rating_difference ASC, h1.rating DESC
    `;
    
    const result = await pool.query(query, [userId1, userId2]);
    
    // Calculate compatibility score (0-100)
    const totalHobbies = result.rows.length;
    let compatibilityScore = 0;
    
    if (totalHobbies > 0) {
      const avgDifference = result.rows.reduce((sum, row) => sum + row.rating_difference, 0) / totalHobbies;
      compatibilityScore = Math.max(0, 100 - avgDifference);
    }
    
    res.json({
      success: true,
      data: {
        common_hobbies: result.rows,
        compatibility_score: Math.round(compatibilityScore),
        total_common_hobbies: totalHobbies
      }
    });
  } catch (error) {
    console.error('Error calculating hobby compatibility:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;