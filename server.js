import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

// Import database connection
import connectDB from './config/database.js';

// Import routes
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import testRoutes from './routes/tests.js';
import studentRoutes from './routes/students.js';
import subjectRoutes from './routes/subjects.js';
import dashboardRoutes from './routes/dashboard.js';
import announcementsRoutes from './routes/announcements.js';
import { addOrUpdateMarks } from './controllers/MarksController.js';

dotenv.config();

const app = express();

// CORS Configuration - Enhanced for better development
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
  ],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token'
  ]
}));

app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging with better formatting
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  
  console.log(`[${timestamp}] ${method} ${path}`);
  
  if (['POST', 'PUT', 'PATCH'].includes(method) && Object.keys(req.body).length > 0) {
    console.log('📝 Body keys:', Object.keys(req.body));
  }
  
  next();
});

// Health check - Enhanced
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.json({
    success: true,
    message: 'Server is healthy!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      name: mongoose.connection.db?.databaseName || 'unknown'
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/dashboard', dashboardRoutes);
// Mount students routes once at /api/students
app.use('/api/students', studentRoutes);
// Announcements
app.use('/api/announcements', announcementsRoutes);



// API documentation - Enhanced
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Placement Readiness System API',
    version: '2.0.0',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        profile: 'GET /api/auth/profile'
      },
      tests: {
        list: 'GET /api/tests',
        create: 'POST /api/tests',
        update: 'PUT /api/tests/:id',
        delete: 'DELETE /api/tests/:id',
        results: 'GET /api/tests/:id/results',
        addOrUpdateMarks: 'POST /api/tests/:id/marks'
      },
      students: {
        list: 'GET /api/students',
        myResults: 'GET /api/students/my-results',
        dashboard: 'GET /api/students/dashboard',
        performance: 'GET /api/students/performance'
      },
      admin: 'GET /api/admin',
      subjects: 'GET /api/subjects',
      dashboard: 'GET /api/dashboard'
    },
    features: [
      'JWT Authentication',
      'Test Management',
      'Student Results',
      'Marks Entry System',
      'Dashboard Analytics'
    ],
    cors: 'Enabled for development',
    database: 'MongoDB with Mongoose',
    authentication: 'JWT Bearer tokens'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Placement Readiness System Backend',
    version: '2.0.0',
    status: 'Server is running successfully',
    documentation: '/api',
    health: '/api/health',
    timestamp: new Date().toISOString()
  });
});

// 404 handler - API routes only
app.use('/api/*', (req, res) => {
  console.log(`❌ API Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.originalUrl} not found`,
    suggestion: 'Check /api for available endpoints',
    availableEndpoints: [
      'GET /api/health',
      'POST /api/auth/login',
      'GET /api/tests',
      'GET /api/students/my-results',
      'POST /api/tests/:id/marks'
    ]
  });
});

// Catch-all 404 for non-API routes
app.use('*', (req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    suggestion: 'This is an API server. Check /api for available endpoints'
  });
});

// Global error handler - Enhanced
app.use((error, req, res, next) => {
  console.error('🔥 Server Error:', {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    body: req.body
  });

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(e => e.message);
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed', 
      errors 
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({ 
      success: false, 
      message: `Invalid ${error.path}: ${error.value}` 
    });
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    const value = Object.values(error.keyValue || {})[0];
    return res.status(400).json({ 
      success: false, 
      message: `${field || 'Field'} '${value}' already exists` 
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid authentication token' 
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication token expired' 
    });
  }

  // File upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large'
    });
  }

  // Default error
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error
    })
  });
});

// Startup
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const startServer = async () => {
  try {
    await connectDB();
    
    const server = app.listen(PORT, () => {
      console.log('\n🎉 SERVER STARTED SUCCESSFULLY!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      console.log(`📋 API Docs: http://localhost:${PORT}/api`);
      console.log(`💊 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`🔧 Environment: ${NODE_ENV}`);
      console.log(`🗄️ Database: ${mongoose.connection.db.databaseName}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      console.log('\n🔐 Key API Endpoints:');
      console.log('   🔑 POST /api/auth/login - User login');
      console.log('   📚 POST /api/tests - Create test');
      console.log('   📊 GET /api/students/my-results - Student results');
      console.log('   🎯 POST /api/tests/:id/marks - Submit marks');
      console.log('   📈 GET /api/dashboard/student - Student dashboard');
      console.log('   👥 GET /api/students - List students (for marks entry)');
      
      if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
        console.log(`\n🔑 Default Admin: ${process.env.ADMIN_EMAIL}`);
      }
      
      console.log('\n✨ Features Enabled:');
      console.log('   • Test Creation & Management');
      console.log('   • Student Results & Analytics');
      console.log('   • Marks Entry System');
      console.log('   • Role-based Access Control');
      console.log('   • Dashboard Analytics');
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        console.log('✅ HTTP server closed');
        
        try {
          await mongoose.connection.close();
          console.log('✅ Database connection closed');
          console.log('👋 Server shutdown completed gracefully');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during database shutdown:', error);
          process.exit(1);
        }
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Promise Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();
