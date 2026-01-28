import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/database.js';
import researchRoutes from './routes/research.routes.js';
import authRoutes from './routes/auth.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import reportRoutes from './routes/report.routes.js';
import errorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/report', reportRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Error handling middleware
app.use(errorHandler);

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    // Try to connect to database (but don't fail if it doesn't connect)
    const dbConnection = await connectDB();
    
    if (!dbConnection) {
      // console.warn('⚠️ Starting server WITHOUT database connection');
      // console.warn('⚠️ API endpoints requiring database will fail');
    }
    
    // Start server regardless of database connection
    app.listen(PORT, () => {
      // console.log(`\n${'='.repeat(50)}`);
      // console.log(`🚀 Server running on port ${PORT}`);
      // console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      // console.log(`🌐 Local URL: http://localhost:${PORT}`);
      // console.log(`📊 Database: ${dbConnection ? '✅ Connected' : '❌ Disconnected'}`);
      // console.log(`${'='.repeat(50)}\n`);
    });
  } catch (error) {
    // console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  // console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});
