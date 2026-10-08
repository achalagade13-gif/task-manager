require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Security HTTP headers with configured Content Security Policy
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'", 'https:']
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// CORS setup
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
  message: {
    success: false,
    message: 'Too many requests from this IP address, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', globalLimiter);

// Serve static frontend assets from client/
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// Serve specific HTML routes
app.get('/login', (req, res) => res.sendFile(path.join(clientPath, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(clientPath, 'register.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(clientPath, 'dashboard.html')));
app.get('/tasks', (req, res) => res.sendFile(path.join(clientPath, 'tasks.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(clientPath, 'profile.html')));

// 404 & Centralized Error Handlers
app.use('/api/*', notFoundHandler);

// Fallback to index.html for frontend root
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Centralized error handler
app.use(errorHandler);

// Start the HTTP server immediately, then probe the database in the background.
// This ensures slow Supabase DNS lookups never delay server startup.
const startServer = () => {
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🚀 Task Manager Pro Server running on port ${PORT}`);
      console.log(`📡 Local URL: http://localhost:${PORT}`);
      console.log(`🌍 Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=========================================`);
      resolve(server);
    });

    server.on('error', (err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
  });
};

// Boot: start HTTP first, then connect DB in background
startServer().then((server) => {
  // Non-blocking DB probe (never crashes the server)
  connectDB().catch((err) => {
    console.warn('[Supabase] Background connection probe failed:', err.message);
  });
  return server;
});

process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection]', err.message);
});

module.exports = app;
