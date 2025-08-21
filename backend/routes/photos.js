const express = require('express');
const multer = require('multer');
const pool = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  }
});

// Get all photos for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const query = `
      SELECT id, url, is_profile_picture, uploaded_at
      FROM user_photos 
      WHERE user_id = $1 
      ORDER BY is_profile_picture DESC, uploaded_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Upload photo
router.post('/user/:userId/upload', upload.single('photo'), async (req, res) => {
  try {
    const userId = req.params.userId;
    const { is_profile_picture = false } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    // Check if user exists
    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userExists.rows.length === 0) {
      // Clean up uploaded file
      await fs.unlink(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // If this is to be a profile picture, unset current profile picture
    if (is_profile_picture === 'true' || is_profile_picture === true) {
      await pool.query(
        'UPDATE user_photos SET is_profile_picture = false WHERE user_id = $1',
        [userId]
      );
    }
    
    // Create URL for the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;
    
    // Read file as binary data for BLOB storage (optional)
    const fileData = await fs.readFile(req.file.path);
    
    const query = `
      INSERT INTO user_photos (user_id, data, url, is_profile_picture)
      VALUES ($1, $2, $3, $4)
      RETURNING id, url, is_profile_picture, uploaded_at
    `;
    
    const result = await pool.query(query, [
      userId, 
      fileData, 
      fileUrl, 
      is_profile_picture === 'true' || is_profile_picture === true
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error uploading photo:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Add photo by URL
router.post('/user/:userId/url', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { url, is_profile_picture = false } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required'
      });
    }
    
    // Check if user exists
    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // If this is to be a profile picture, unset current profile picture
    if (is_profile_picture) {
      await pool.query(
        'UPDATE user_photos SET is_profile_picture = false WHERE user_id = $1',
        [userId]
      );
    }
    
    const query = `
      INSERT INTO user_photos (user_id, url, is_profile_picture)
      VALUES ($1, $2, $3)
      RETURNING id, url, is_profile_picture, uploaded_at
    `;
    
    const result = await pool.query(query, [userId, url, is_profile_picture]);
    
    res.status(201).json({
      success: true,
      message: 'Photo URL added successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding photo URL:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Set profile picture
router.put('/:photoId/profile', async (req, res) => {
  try {
    const photoId = req.params.photoId;
    
    // Get the photo and user_id
    const photoResult = await pool.query('SELECT user_id FROM user_photos WHERE id = $1', [photoId]);
    
    if (photoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }
    
    const userId = photoResult.rows[0].user_id;
    
    // Begin transaction
    await pool.query('BEGIN');
    
    try {
      // Unset current profile picture
      await pool.query(
        'UPDATE user_photos SET is_profile_picture = false WHERE user_id = $1',
        [userId]
      );
      
      // Set new profile picture
      const result = await pool.query(
        'UPDATE user_photos SET is_profile_picture = true WHERE id = $1 RETURNING *',
        [photoId]
      );
      
      await pool.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Profile picture updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error setting profile picture:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete photo
router.delete('/:photoId', async (req, res) => {
  try {
    const photoId = req.params.photoId;
    
    // Get photo info before deletion
    const photoResult = await pool.query('SELECT url FROM user_photos WHERE id = $1', [photoId]);
    
    if (photoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }
    
    const photoUrl = photoResult.rows[0].url;
    
    // Delete from database
    await pool.query('DELETE FROM user_photos WHERE id = $1', [photoId]);
    
    // Delete file from disk if it's a local file
    if (photoUrl && photoUrl.startsWith('/uploads/')) {
      try {
        const filePath = path.join(process.env.UPLOAD_PATH || './uploads', path.basename(photoUrl));
        await fs.unlink(filePath);
      } catch (fileError) {
        console.error('Error deleting file:', fileError);
        // Don't fail the request if file deletion fails
      }
    }
    
    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get photo data (serve image)
router.get('/:photoId/data', async (req, res) => {
  try {
    const photoId = req.params.photoId;
    
    const result = await pool.query('SELECT data, url FROM user_photos WHERE id = $1', [photoId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }
    
    const photo = result.rows[0];
    
    if (photo.data) {
      // Serve from BLOB data
      res.set('Content-Type', 'image/jpeg'); // Default to JPEG, could be improved
      res.send(photo.data);
    } else if (photo.url && photo.url.startsWith('/uploads/')) {
      // Serve from file system
      const filePath = path.join(process.env.UPLOAD_PATH || './uploads', path.basename(photo.url));
      res.sendFile(path.resolve(filePath));
    } else {
      // External URL - redirect
      res.redirect(photo.url);
    }
  } catch (error) {
    console.error('Error serving photo:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;