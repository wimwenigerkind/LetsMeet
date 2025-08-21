const errorHandler = (err, req, res, next) => {
  console.error('Error stack:', err.stack);
  
  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large',
      error: 'FILE_TOO_LARGE'
    });
  }
  
  if (err.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed',
      error: 'INVALID_FILE_TYPE'
    });
  }
  
  // PostgreSQL errors
  if (err.code === '23505') { // Unique violation
    return res.status(400).json({
      success: false,
      message: 'Duplicate entry',
      error: 'DUPLICATE_ENTRY'
    });
  }
  
  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist',
      error: 'FOREIGN_KEY_VIOLATION'
    });
  }
  
  if (err.code === '23502') { // Not null violation
    return res.status(400).json({
      success: false,
      message: 'Required field is missing',
      error: 'MISSING_REQUIRED_FIELD'
    });
  }
  
  if (err.code === '22001') { // String too long
    return res.status(400).json({
      success: false,
      message: 'Value too long for field',
      error: 'VALUE_TOO_LONG'
    });
  }
  
  // Validation errors from Joi
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: err.details,
      error: 'VALIDATION_ERROR'
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: 'INVALID_TOKEN'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      error: 'TOKEN_EXPIRED'
    });
  }
  
  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    message: message,
    error: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;