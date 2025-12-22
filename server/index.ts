import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../src/config/swagger.js';
import chatRouter from './api/chat.js';
import authRouter from '../src/routes/auth.routes.js';
import userRouter from '../src/routes/user.routes.js';
import courseRouter from '../src/routes/course.routes.js';
import scheduleRouter from '../src/routes/schedule.routes.js';
import attendanceRouter from '../src/routes/attendance.routes.js';
import professorSettingsRouter from '../src/routes/professor-settings.routes.js';
import notificationRouter from '../src/routes/notification.routes.js';
import materialRouter from '../src/routes/material.routes.js';
import quizRouter from '../src/routes/quiz.routes.js';
import { SocketService } from '../src/services/socket.service.js';
import { initializeNotificationController } from '../src/controllers/notification.controller.js';
import { setAttendanceSocketService } from '../src/routes/attendance.routes.js';
import { envConfig } from '../config/environment.js';
import logger from '../src/utils/logger.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Netlify/Railway)
const PORT = envConfig.server.port;

// Create HTTP server for Socket.io
const httpServer = createServer(app);

// Middleware
app.use(helmet()); // Security headers

// Enhanced CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = envConfig.cors.allowedOrigins;

    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // Check if origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      // Log the blocked origin for debugging
      logger.warn(`🚫 CORS Blocked Origin: ${origin}`);
      // For now, in production debugging, you might want to temporarily allow it or just fail
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan(envConfig.server.nodeEnv === 'production' ? 'combined' : 'dev'));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Security headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Initialize Socket.io service
const socketService = new SocketService(httpServer);

// Initialize notification controller with socket service
initializeNotificationController(socketService);

// Initialize attendance routes with socket service for real-time notifications
setAttendanceSocketService(socketService);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/courses', courseRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/professor/settings', professorSettingsRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/materials', materialRouter);
app.use('/api/quizzes', quizRouter);
app.use('/api', chatRouter);

// Temporary debug ping for chat
app.get('/api/chat/ping', (req, res) => res.json({ ok: true }));

// List registered routes for debugging (only if DEBUG_ROUTES=true)
if (process.env.DEBUG_ROUTES === 'true') {
  try {
    const list: string[] = [];
    // @ts-ignore
    app._router?.stack?.forEach((r: any) => r.route && list.push(`${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`));
    logger.info('📋 Registered Routes:', list);
  } catch { }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'disconnected';
    logger.error('Health check DB error:', e);
  }

  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    environment: envConfig.server.nodeEnv,
    version: '1.0.0',
    database: dbStatus
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Smart Campus Assistant API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      courses: '/api/courses',
      schedule: '/api/schedule',
      attendance: '/api/attendance',
      notifications: '/api/notifications',
      chat: '/api',
      health: '/health'
    },
    documentation: 'https://github.com/your-repo/docs'
  });
});

// API 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Serve static files from the React app
// In production, the server is in dist/server/index.js, so we go up one level to dist/
const distPath = path.join(__dirname, '../');
app.use(express.static(distPath));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  // Check if we are in production and the file exists
  if (envConfig.server.nodeEnv === 'production') {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.status(404).json({
      success: false,
      message: 'Frontend not served in development mode (use Vite dev server)',
      path: req.originalUrl
    });
  }
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Global error handler:', error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(envConfig.server.nodeEnv === 'development' && { stack: error.stack })
  });
});

// Database Connection Check
import prisma from '../config/database.js';
async function checkDatabaseConnection() {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    // Don't exit process, let it keep trying or fail on request
  } finally {
    // Don't disconnect in production as we want to keep the connection pool alive
    if (process.env.NODE_ENV !== 'production') {
      await prisma.$disconnect();
    }
  }
}

// Start server
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  // Start server immediately to avoid timeouts
  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Smart Campus Assistant API server listening on http://0.0.0.0:${PORT}`);
    logger.info(`📊 Environment: ${envConfig.server.nodeEnv}`);
    logger.info(`🔐 JWT Secret configured: ${envConfig.jwt.secret && envConfig.jwt.secret !== 'your-super-secret-jwt-key-change-in-production-make-it-very-long-and-random' ? 'Yes (Custom)' : 'No (Default/Unsafe)'}`);
    logger.info(`🌐 CORS Origins: ${envConfig.cors.allowedOrigins.join(', ')}`);
    logger.info(`🔌 Socket.io server initialized`);

    if (!process.env.DATABASE_URL) {
      logger.error('❌ CRITICAL: DATABASE_URL is not defined in environment variables!');
    }

    // Check database connection in background
    checkDatabaseConnection();
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  socketService.cleanup();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  socketService.cleanup();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default app;
