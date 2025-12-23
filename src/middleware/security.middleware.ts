/**
 * Security Middleware
 * Comprehensive security measures for the application
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createSecurityError } from '../utils/errorHandler';

// Rate limiting configurations
export const createRateLimit = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each IP to 100 requests per windowMs
    message = 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skipFailedRequests,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Specific rate limits for different endpoints
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true
});

export const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 API requests per 15 minutes
  message: 'Too many API requests, please try again later.'
});

export const uploadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: 'Too many file uploads, please try again later.'
});

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://yourdomain.com',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ]
};

// Helmet configuration for security headers
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// XSS protection middleware
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  // Set XSS protection headers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
};

// CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Check for CSRF token
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = (req as any).session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    const error = createSecurityError('CSRF token mismatch', { 
      provided: !!token,
      expected: !!sessionToken 
    });
    return next(error);
  }

  next();
};

// SQL injection protection middleware
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
  const checkForSQLInjection = (value: any): boolean => {
    if (typeof value === 'string') {
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
        /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
        /(\b(OR|AND)\s+['"]\s*=\s*['"])/i,
        /(UNION\s+SELECT)/i,
        /(DROP\s+TABLE)/i,
        /(DELETE\s+FROM)/i,
        /(INSERT\s+INTO)/i,
        /(UPDATE\s+SET)/i,
        /(EXEC\s*\()/i,
        /(SCRIPT\s*>)/i
      ];

      return sqlPatterns.some(pattern => pattern.test(value));
    }
    
    if (Array.isArray(value)) {
      return value.some(checkForSQLInjection);
    }
    
    if (value && typeof value === 'object') {
      return Object.values(value).some(checkForSQLInjection);
    }
    
    return false;
  };

  const checkObject = (obj: any, path: string = '') => {
    if (checkForSQLInjection(obj)) {
      const error = createSecurityError('Potential SQL injection detected', { 
        path,
        value: typeof obj === 'string' ? obj.substring(0, 100) : obj 
      });
      throw error;
    }
  };

  try {
    if (req.body) checkObject(req.body, 'body');
    if (req.query) checkObject(req.query, 'query');
    if (req.params) checkObject(req.params, 'params');
    
    next();
  } catch (error) {
    next(error);
  }
};

// File upload security middleware
export const fileUploadSecurity = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file && !req.files) {
    return next();
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const validateFile = (file: any) => {
    // Check file size
    if (file.size > maxFileSize) {
      throw createSecurityError('File size too large', { 
        size: file.size,
        maxSize: maxFileSize 
      });
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw createSecurityError('File type not allowed', { 
        mimeType: file.mimetype,
        allowedTypes: allowedMimeTypes 
      });
    }

    // Check file extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt', '.doc', '.docx'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      throw createSecurityError('File extension not allowed', { 
        extension: fileExtension,
        allowedExtensions 
      });
    }

    // Check for executable files
    const executablePatterns = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar'];
    if (executablePatterns.some(pattern => file.originalname.toLowerCase().includes(pattern))) {
      throw createSecurityError('Executable files are not allowed', { 
        filename: file.originalname 
      });
    }
  };

  try {
    if (req.file) {
      validateFile(req.file);
    }
    
    if (req.files) {
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      files.forEach(validateFile);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// Request logging middleware
export const requestLogging = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    // Log suspicious activity
    if (res.statusCode >= 400) {
      console.warn('Suspicious request:', logData);
    } else {
      console.log('Request:', logData);
    }
  });

  next();
};

// IP whitelist middleware
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
      const error = createSecurityError('IP address not allowed', { 
        ip: clientIP,
        allowedIPs 
      });
      return next(error);
    }
    
    next();
  };
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Export all security middleware
export const securityMiddleware = {
  createRateLimit,
  authRateLimit,
  apiRateLimit,
  uploadRateLimit,
  corsOptions,
  helmetConfig,
  sanitizeInput,
  xssProtection,
  csrfProtection,
  sqlInjectionProtection,
  fileUploadSecurity,
  requestLogging,
  ipWhitelist,
  securityHeaders
};

export default securityMiddleware;
