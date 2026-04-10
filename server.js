/**
 * server.js — IslamQA Backend
 * ============================
 * Entry point for the IslamQA REST API server.
 * Sets up Express, middleware, all routes, and starts listening.
 *
 * To run:
 *   npm install       ← install dependencies (first time only)
 *   npm run dev       ← development (auto-restarts on file changes)
 *   npm start         ← production
 */

const express = require('express');
const cors    = require('cors');

// ── Route files ──────────────────────────────────────────────────
const articleRoutes  = require('./routes/articles');
const questionRoutes = require('./routes/questions');
const answerRoutes   = require('./routes/answers');
const categoryRoutes = require('./routes/categories');
const searchRoutes   = require('./routes/search');   // NEW

// ── App setup ────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// ================================================================
// MIDDLEWARE
// ================================================================

/**
 * cors()
 * Allows the IslamQA frontend (port 8080) to call this API.
 * Add any other origins here if you deploy to a live domain.
 */
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:5500',    // VS Code Live Server fallback
    'http://127.0.0.1:5500',
  ],
  methods: ['GET', 'POST'],
}));

/**
 * express.json()
 * Parses JSON request bodies so req.body works in POST routes.
 */
app.use(express.json());

/**
 * Request logger — shows every request in the terminal.
 * Remove or replace with morgan in production.
 */
app.use((req, _res, next) => {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}]  ${req.method.padEnd(6)} ${req.path}`);
  next();
});

// ================================================================
// ROUTES
// ================================================================

app.use('/articles',   articleRoutes);
app.use('/questions',  questionRoutes);
app.use('/answers',    answerRoutes);
app.use('/categories', categoryRoutes);
app.use('/search',     searchRoutes);   // NEW: GET /search?q=tawheed

// ================================================================
// ROOT — health check
// ================================================================

app.get('/', (_req, res) => {
  res.json({
    name:    'IslamQA API',
    version: '1.1.0',
    status:  'running',
    endpoints: {
      articles:   'GET /articles | GET /articles/:id | GET /articles?category=fiqh',
      categories: 'GET /categories | GET /categories/:id',
      questions:  'GET /questions | GET /questions/:id | GET /questions?status=pending | POST /questions',
      answers:    'GET /answers/:questionId | POST /answers',
      search:     'GET /search?q=tawheed',
    },
  });
});

// ================================================================
// 404 HANDLER — must be after all routes
// ================================================================

app.use((req, res) => {
  res.status(404).json({
    error:   'Route not found',
    message: `${req.method} ${req.path} does not exist. Check GET / for all valid endpoints.`,
  });
});

// ================================================================
// GLOBAL ERROR HANDLER — must be last, needs 4 arguments
// ================================================================

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Server error:', err.message);
  res.status(500).json({
    error:   'Internal server error',
    message: 'Something went wrong. Please try again.',
  });
});

// ================================================================
// START SERVER
// ================================================================

app.listen(PORT, () => {
  console.log('');
  console.log('بسم الله الرحمن الرحيم');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  IslamQA API — Server running');
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Frontend: http://localhost:8080`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});
