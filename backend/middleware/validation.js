const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

const schemas = {
  createUser: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    first_name: Joi.string().required(),
    last_name: Joi.string().required(),
    phone_number: Joi.string().optional(),
    gender: Joi.string().valid('m', 'w', 'nicht binär').optional(),
    preferred_gender: Joi.string().valid('m', 'w', 'nicht binär').optional(),
    birth_date: Joi.date().optional()
  }),

  updateUser: Joi.object({
    first_name: Joi.string().optional(),
    last_name: Joi.string().optional(),
    phone_number: Joi.string().optional(),
    gender: Joi.string().valid('m', 'w', 'nicht binär').optional(),
    preferred_gender: Joi.string().valid('m', 'w', 'nicht binär').optional(),
    birth_date: Joi.date().optional()
  }),

  createAddress: Joi.object({
    street: Joi.string().required(),
    house_number: Joi.string().required(),
    postal_code: Joi.string().required(),
    city: Joi.string().required()
  }),

  createHobby: Joi.object({
    name: Joi.string().required(),
    rating: Joi.number().min(-100).max(100).required()
  }),

  updateHobbyRating: Joi.object({
    rating: Joi.number().min(-100).max(100).required()
  }),

  createFriendship: Joi.object({
    user_id_2: Joi.number().integer().required()
  }),

  updateFriendshipStatus: Joi.object({
    status: Joi.string().valid('pending', 'accepted', 'rejected').required()
  }),

  createMessage: Joi.object({
    conversation_id: Joi.number().integer().required(),
    message_text: Joi.string().required()
  })
};

module.exports = { validateRequest, schemas };