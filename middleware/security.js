// middleware/security.js
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import xss from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import compression from 'compression';

// Security middleware setup
export const securityMiddleware = (app) => {
  // Helmet - Sets various HTTP headers for security
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.razorpay.com"]
      }
    }
  }));

  // CORS - Configured for production
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Rate limiting - Prevent DDoS
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api', limiter);

  // Stricter rate limit for auth routes
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many authentication attempts, please try again later.'
  });
  app.use('/api/auth', authLimiter);

  // Data sanitization
  app.use(xss()); // Sanitize user input
  app.use(mongoSanitize()); // Prevent NoSQL injection
  
  // Prevent parameter pollution
  app.use(hpp());

  // Compression
  app.use(compression());
};