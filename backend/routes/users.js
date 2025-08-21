const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { validateRequest, schemas } = require('../middleware/validation');
const router = express.Router();

// Get all users with optional filtering
router.get('/', async (req, res) => {
  try {
    const { gender, preferred_gender, city, hobby } = req.query;
    
    let query = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.gender, 
             u.preferred_gender, u.birth_date, u.created_at,
             a.street, a.house_number, a.postal_code, a.city
      FROM users u
      LEFT JOIN addresses a ON u.id = a.user_id
    `;
    
    const conditions = [];
    const values = [];
    
    if (gender) {
      conditions.push(`u.gender = $${values.length + 1}`);
      values.push(gender);
    }
    
    if (preferred_gender) {
      conditions.push(`u.preferred_gender = $${values.length + 1}`);
      values.push(preferred_gender);
    }
    
    if (city) {
      conditions.push(`a.city ILIKE $${values.length + 1}`);
      values.push(`%${city}%`);
    }
    
    if (hobby) {
      query += ` LEFT JOIN hobbies h ON u.id = h.user_id`;
      conditions.push(`h.name ILIKE $${values.length + 1}`);
      values.push(`%${hobby}%`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY u.created_at DESC`;
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user by ID with hobbies and photos
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Get user basic info
    const userQuery = `
      SELECT u.*, a.street, a.house_number, a.postal_code, a.city
      FROM users u
      LEFT JOIN addresses a ON u.id = a.user_id
      WHERE u.id = $1
    `;
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get user hobbies
    const hobbiesQuery = 'SELECT * FROM hobbies WHERE user_id = $1 ORDER BY rating DESC';
    const hobbiesResult = await pool.query(hobbiesQuery, [userId]);
    
    // Get user photos
    const photosQuery = 'SELECT id, url, is_profile_picture, uploaded_at FROM user_photos WHERE user_id = $1';
    const photosResult = await pool.query(photosQuery, [userId]);
    
    const user = userResult.rows[0];
    delete user.password; // Never return password
    
    res.json({
      success: true,
      data: {
        ...user,
        hobbies: hobbiesResult.rows,
        photos: photosResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new user
router.post('/', validateRequest(schemas.createUser), async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone_number, gender, preferred_gender, birth_date } = req.body;
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const query = `
      INSERT INTO users (email, password, first_name, last_name, phone_number, gender, preferred_gender, birth_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, first_name, last_name, created_at
    `;
    
    const values = [email, hashedPassword, first_name, last_name, phone_number, gender, preferred_gender, birth_date];
    const result = await pool.query(query, values);
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user
router.put('/:id', validateRequest(schemas.updateUser), async (req, res) => {
  try {
    const userId = req.params.id;
    const updates = req.body;
    
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [userId, ...Object.values(updates)];
    
    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, first_name, last_name, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Add address for user
router.post('/:id/address', validateRequest(schemas.createAddress), async (req, res) => {
  try {
    const userId = req.params.id;
    const { street, house_number, postal_code, city } = req.body;
    
    // Check if user exists
    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const query = `
      INSERT INTO addresses (user_id, street, house_number, postal_code, city)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, street, house_number, postal_code, city]);
    
    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding address:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Find users with similar interests
router.get('/:id/similar', async (req, res) => {
  try {
    const userId = req.params.id;
    
    const query = `
      SELECT DISTINCT u2.id, u2.first_name, u2.last_name, u2.gender, u2.birth_date,
             a.city,
             COUNT(CASE WHEN h1.name = h2.name AND h1.rating > 50 AND h2.rating > 50 THEN 1 END) as common_hobbies
      FROM users u1
      JOIN hobbies h1 ON u1.id = h1.user_id
      JOIN hobbies h2 ON h1.name = h2.name
      JOIN users u2 ON h2.user_id = u2.id
      LEFT JOIN addresses a ON u2.id = a.user_id
      WHERE u1.id = $1 AND u2.id != $1
      GROUP BY u2.id, u2.first_name, u2.last_name, u2.gender, u2.birth_date, a.city
      HAVING COUNT(CASE WHEN h1.name = h2.name AND h1.rating > 50 AND h2.rating > 50 THEN 1 END) > 0
      ORDER BY common_hobbies DESC, u2.first_name
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error finding similar users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;