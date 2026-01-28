/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // console.error('❌ Error occurred:', { message: err.message, stack: err.stack, path: req.path, method: req.method });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Duplicate Entry',
      details: 'A record with this identifier already exists'
    });
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID Format',
      details: `Invalid ${err.path}: ${err.value}`
    });
  }

  // Default error response
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default errorHandler;
