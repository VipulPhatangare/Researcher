import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Set mongoose options
    mongoose.set('strictQuery', false);
    
    // Connection options with retries
    const options = {
      serverSelectionTimeoutMS: 30000, // Increased to 30 seconds
      socketTimeoutMS: 60000, // Increased to 60 seconds
      connectTimeoutMS: 30000, // Increased to 30 seconds
      maxPoolSize: 10,
      minPoolSize: 2,
      retryWrites: true,
      retryReads: true,
    };

    // console.log('🔄 Connecting to MongoDB...');
    // console.log('📍 MongoDB URI:', process.env.MONGODB_URI?.substring(0, 30) + '...');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    // console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    // console.log(`📊 Database: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      // console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      // console.warn('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      // console.log('✅ MongoDB reconnected');
    });
    
    return conn;
  } catch (error) {
    // console.error('❌ MongoDB Connection Error:', error.message);
    // console.error('💡 Troubleshooting tips:');
    // console.error('   1. Check if MongoDB URI is correct in .env file');
    // console.error('   2. Verify network/internet connection');
    // console.error('   3. Check MongoDB Atlas cluster is running (not paused)');
    // console.error('   4. Verify IP address is whitelisted in MongoDB Atlas');
    // console.error('   5. Check username/password are correct');
    // console.error('\n⚠️ Server will continue but database operations will fail!');
    
    // Don't throw - let server start anyway for debugging
    return null;
  }
};

export default connectDB;
