const express = require('express');
const pool = require('../config/database');
const { validateRequest, schemas } = require('../middleware/validation');
const router = express.Router();

// Get conversations for a user
router.get('/conversations/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const query = `
      SELECT DISTINCT 
        c.id as conversation_id,
        c.created_at as conversation_created,
        -- Get the other participant(s) info
        STRING_AGG(
          CASE WHEN cu.user_id != $1 
            THEN u.first_name || ' ' || u.last_name 
          END, ', '
        ) as participants,
        -- Get last message
        (SELECT m.message_text 
         FROM messages m 
         WHERE m.conversation_id = c.id 
         ORDER BY m.sent_at DESC 
         LIMIT 1) as last_message,
        (SELECT m.sent_at 
         FROM messages m 
         WHERE m.conversation_id = c.id 
         ORDER BY m.sent_at DESC 
         LIMIT 1) as last_message_time,
        -- Count unread messages (simplified - in production you'd need a read status)
        (SELECT COUNT(*) 
         FROM messages m 
         WHERE m.conversation_id = c.id 
           AND m.sender_user_id != $1) as message_count
      FROM conversations c
      JOIN conversations_users cu ON c.id = cu.conversation_id
      LEFT JOIN users u ON cu.user_id = u.id
      WHERE c.id IN (
        SELECT conversation_id 
        FROM conversations_users 
        WHERE user_id = $1
      )
      GROUP BY c.id, c.created_at
      ORDER BY last_message_time DESC NULLS LAST, c.created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get messages in a conversation
router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const { limit = 50, offset = 0 } = req.query;
    
    const query = `
      SELECT 
        m.id,
        m.message_text,
        m.sent_at,
        m.sender_user_id,
        u.first_name,
        u.last_name
      FROM messages m
      JOIN users u ON m.sender_user_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.sent_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [conversationId, limit, offset]);
    
    res.json({
      success: true,
      data: result.rows.reverse(), // Reverse to show oldest first
      has_more: result.rows.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new conversation
router.post('/conversations', async (req, res) => {
  try {
    const { participants } = req.body; // Array of user IDs
    
    if (!participants || participants.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 participants are required'
      });
    }
    
    // Check if all users exist
    const usersExist = await pool.query(
      `SELECT id FROM users WHERE id = ANY($1::int[])`,
      [participants]
    );
    
    if (usersExist.rows.length !== participants.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more users not found'
      });
    }
    
    // Begin transaction
    await pool.query('BEGIN');
    
    try {
      // Create conversation
      const conversationResult = await pool.query(
        'INSERT INTO conversations DEFAULT VALUES RETURNING *'
      );
      
      const conversationId = conversationResult.rows[0].id;
      
      // Add participants
      for (const userId of participants) {
        await pool.query(
          'INSERT INTO conversations_users (conversation_id, user_id) VALUES ($1, $2)',
          [conversationId, userId]
        );
      }
      
      await pool.query('COMMIT');
      
      res.status(201).json({
        success: true,
        message: 'Conversation created successfully',
        data: {
          conversation_id: conversationId,
          participants: participants
        }
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send message
router.post('/', validateRequest(schemas.createMessage), async (req, res) => {
  try {
    const { conversation_id, message_text } = req.body;
    const sender_user_id = req.body.sender_user_id; // In production, get from auth token
    
    // Check if conversation exists and user is participant
    const participantCheck = await pool.query(`
      SELECT cu.user_id 
      FROM conversations_users cu 
      WHERE cu.conversation_id = $1 AND cu.user_id = $2
    `, [conversation_id, sender_user_id]);
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'User is not a participant in this conversation'
      });
    }
    
    const query = `
      INSERT INTO messages (conversation_id, sender_user_id, message_text)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await pool.query(query, [conversation_id, sender_user_id, message_text]);
    
    // Get sender info
    const senderQuery = `
      SELECT first_name, last_name 
      FROM users 
      WHERE id = $1
    `;
    const senderResult = await pool.query(senderQuery, [sender_user_id]);
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        ...result.rows[0],
        sender_name: `${senderResult.rows[0].first_name} ${senderResult.rows[0].last_name}`
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete message
router.delete('/:messageId', async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const userId = req.body.user_id; // In production, get from auth token
    
    // Check if user is the sender of the message
    const messageCheck = await pool.query(
      'SELECT sender_user_id FROM messages WHERE id = $1',
      [messageId]
    );
    
    if (messageCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    if (messageCheck.rows[0].sender_user_id !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }
    
    await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Search conversations and messages
router.get('/search', async (req, res) => {
  try {
    const { q: searchQuery, user_id } = req.query;
    
    if (!searchQuery || !user_id) {
      return res.status(400).json({
        success: false,
        message: 'Search query and user_id are required'
      });
    }
    
    const query = `
      SELECT 
        m.id,
        m.conversation_id,
        m.message_text,
        m.sent_at,
        m.sender_user_id,
        u.first_name,
        u.last_name,
        -- Highlight matching text (simplified)
        ts_headline(m.message_text, plainto_tsquery($1)) as highlighted_text
      FROM messages m
      JOIN users u ON m.sender_user_id = u.id
      JOIN conversations_users cu ON m.conversation_id = cu.conversation_id
      WHERE cu.user_id = $2
        AND to_tsvector('german', m.message_text) @@ plainto_tsquery('german', $1)
      ORDER BY m.sent_at DESC
      LIMIT 50
    `;
    
    const result = await pool.query(query, [searchQuery, user_id]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;