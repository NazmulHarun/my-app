/**
 * routes/search.js — Search Route
 * =================================
 * Handles GET /search?q=tawheed
 *
 * Searches across all articles and questions simultaneously
 * and returns a combined, ranked list of results.
 *
 * Query parameters:
 *   q        (required) — the search term
 *   type     (optional) — filter by 'article' or 'question'
 *   limit    (optional) — max results to return (default 20)
 *
 * Example requests:
 *   GET /search?q=tawheed
 *   GET /search?q=fasting&type=question
 *   GET /search?q=wudu&limit=5
 */

const express   = require('express');
const router    = express.Router();

const articles  = require('../data/articles');
const questions = require('../data/questions');

// ================================================================
// SEARCH HELPER
// Scores each item based on where the query match occurs.
// Title match scores higher than body/snippet match.
// ================================================================

/**
 * scoreMatch
 * Returns a relevance score for a text item against a query.
 * Higher score = more relevant.
 *
 * @param {string} query      - lowercased search query
 * @param {string} title      - item title (weighted more heavily)
 * @param {string} body       - item body / excerpt (weighted less)
 * @param {string} category   - item category
 * @returns {number} score (0 = no match)
 */
function scoreMatch(query, title = '', body = '', category = '') {
  const lTitle    = title.toLowerCase();
  const lBody     = body.toLowerCase();
  const lCategory = category.toLowerCase();
  let   score     = 0;

  // Exact title match — highest priority
  if (lTitle === query)              score += 100;
  // Title starts with the query
  if (lTitle.startsWith(query))     score += 60;
  // Title contains the query
  if (lTitle.includes(query))       score += 40;
  // Category matches
  if (lCategory.includes(query))    score += 20;
  // Body / excerpt contains the query
  if (lBody.includes(query))        score += 10;

  return score;
}

// ================================================================
// GET /search?q=tawheed
// ================================================================

router.get('/', (req, res) => {
  const rawQuery = req.query.q;
  const typeFilter = req.query.type ? req.query.type.toLowerCase() : null;
  const limit    = Math.min(parseInt(req.query.limit) || 20, 50); // cap at 50

  // Require a search query
  if (!rawQuery || rawQuery.trim().length === 0) {
    return res.status(400).json({
      error:   'Missing search query',
      message: 'Please provide a search term using ?q=your+query',
    });
  }

  if (rawQuery.trim().length < 2) {
    return res.status(400).json({
      error:   'Query too short',
      message: 'Search query must be at least 2 characters.',
    });
  }

  const query = rawQuery.trim().toLowerCase();
  const results = [];

  // ── Search articles ──────────────────────────────────────────
  if (!typeFilter || typeFilter === 'article') {
    articles.forEach(article => {
      const score = scoreMatch(
        query,
        article.title,
        article.excerpt,
        article.category
      );
      if (score > 0) {
        results.push({
          type:      'article',
          score:     score,
          id:        article.id,
          title:     article.title,
          excerpt:   article.excerpt,
          category:  article.category,
          author:    article.author,
          date:      article.date,
          readTime:  article.readTime,
          slug:      article.slug,
        });
      }
    });
  }

  // ── Search questions ─────────────────────────────────────────
  if (!typeFilter || typeFilter === 'question') {
    questions.forEach(question => {
      const score = scoreMatch(
        query,
        question.question,
        '',
        question.category
      );
      if (score > 0) {
        results.push({
          type:      'question',
          score:     score,
          id:        question.id,
          title:     question.question,
          excerpt:   `Status: ${question.status} · Category: ${question.category}`,
          category:  question.category,
          status:    question.status,
          date:      question.createdAt,
        });
      }
    });
  }

  // ── Sort by relevance score (highest first) ──────────────────
  results.sort((a, b) => b.score - a.score);

  // ── Apply limit ──────────────────────────────────────────────
  const paginated = results.slice(0, limit);

  // ── Respond ──────────────────────────────────────────────────
  res.json({
    query:    rawQuery.trim(),
    total:    results.length,
    showing:  paginated.length,
    data:     paginated,
  });
});

module.exports = router;
