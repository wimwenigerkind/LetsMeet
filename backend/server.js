const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const pool = require('./config/database');

// Import routes
const userRoutes = require('./routes/users');
const hobbyRoutes = require('./routes/hobbies');
const friendshipRoutes = require('./routes/friendships');
const photoRoutes = require('./routes/photos');
const messageRoutes = require('./routes/messages');
const likeRoutes = require('./routes/likes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (uploaded photos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    res.json({
      success: true,
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Server is unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/hobbies', hobbyRoutes);
app.use('/api/friendships', friendshipRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/likes', likeRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Let\'s Meet API',
    version: '1.0.0',
    endpoints: {
      users: {
        'GET /api/users': 'Get all users with optional filtering',
        'GET /api/users/:id': 'Get user by ID with hobbies and photos',
        'POST /api/users': 'Create new user',
        'PUT /api/users/:id': 'Update user',
        'DELETE /api/users/:id': 'Delete user',
        'POST /api/users/:id/address': 'Add address for user',
        'GET /api/users/:id/similar': 'Find users with similar interests'
      },
      hobbies: {
        'GET /api/hobbies/user/:userId': 'Get all hobbies for a user',
        'POST /api/hobbies/user/:userId': 'Add hobby for user',
        'PUT /api/hobbies/:hobbyId': 'Update hobby rating',
        'DELETE /api/hobbies/:hobbyId': 'Delete hobby',
        'GET /api/hobbies/stats': 'Get hobbies statistics',
        'GET /api/hobbies/interest/:hobbyName': 'Find users by hobby interest',
        'GET /api/hobbies/compatibility/:userId1/:userId2': 'Get hobby compatibility between users'
      },
      friendships: {
        'GET /api/friendships/user/:userId': 'Get all friendships for a user',
        'POST /api/friendships/user/:userId/request': 'Send friend request',
        'PUT /api/friendships/:friendshipId/status': 'Respond to friend request',
        'DELETE /api/friendships/:friendshipId': 'Remove friendship',
        'GET /api/friendships/mutual/:userId1/:userId2': 'Get mutual friends',
        'GET /api/friendships/suggestions/:userId': 'Get friend suggestions'
      },
      photos: {
        'GET /api/photos/user/:userId': 'Get all photos for a user',
        'POST /api/photos/user/:userId/upload': 'Upload photo',
        'POST /api/photos/user/:userId/url': 'Add photo by URL',
        'PUT /api/photos/:photoId/profile': 'Set profile picture',
        'DELETE /api/photos/:photoId': 'Delete photo',
        'GET /api/photos/:photoId/data': 'Get photo data'
      },
      messages: {
        'GET /api/messages/conversations/user/:userId': 'Get conversations for a user',
        'GET /api/messages/conversation/:conversationId': 'Get messages in a conversation',
        'POST /api/messages/conversations': 'Create new conversation',
        'POST /api/messages': 'Send message',
        'DELETE /api/messages/:messageId': 'Delete message',
        'GET /api/messages/search': 'Search conversations and messages'
      },
      likes: {
        'GET /api/likes/user/:userId/given': 'Get likes given by user',
        'GET /api/likes/user/:userId/received': 'Get likes received by user',
        'POST /api/likes': 'Like a user',
        'DELETE /api/likes/:likeId': 'Remove a like',
        'GET /api/likes/user/:userId/matches': 'Get matches for user',
        'GET /api/likes/stats': 'Get like statistics'
      }
    },
    use_cases: {
      'User Registration': 'POST /api/users',
      'Update Profile': 'PUT /api/users/:id',
      'Add/Update Hobbies': 'POST /api/hobbies/user/:userId, PUT /api/hobbies/:hobbyId',
      'Find Similar Users': 'GET /api/users/:id/similar',
      'Send Friend Request': 'POST /api/friendships/user/:userId/request',
      'Like Another User': 'POST /api/likes',
      'Upload Profile Picture': 'POST /api/photos/user/:userId/upload',
      'Start Conversation': 'POST /api/messages/conversations',
      'Send Message': 'POST /api/messages'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Let's Meet API Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

module.exports = app;