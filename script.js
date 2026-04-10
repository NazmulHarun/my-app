/**
 * script.js — IslamQA Frontend
 * ==============================
 * All interactivity. Zero inline JS in HTML.
 * Every API call goes through apiFetch() which gracefully falls
 * back to static data if the backend is offline.
 *
 * Sections:
 *   1.  Config & API wrapper
 *   2.  Search  (backend + static fallback)
 *   3.  Articles (fetch + render cards)
 *   4.  Categories (fetch + render)
 *   5.  Q&A (fetch questions + answers + accordion)
 *   6.  Ask Form (POST /questions)
 *   7.  Navigation toggle
 *   8.  Toast notifications
 *   9.  Utility functions
 *   10. Init (DOMContentLoaded — all event listeners)
 */

'use strict';

/* ================================================================
   1. CONFIG & API WRAPPER
   ================================================================ */

const API_BASE = 'http://localhost:3000';

/**
 * apiFetch
 * Wraps every backend call in try/catch.
 * Returns { ok, status, data } — never throws.
 * If the backend is offline, ok = false and data = null.
 */
async function apiFetch(path, options = {}) {
  try {
    const res  = await fetch(API_BASE + path, options);
    const json = await res.json();
    return { ok: res.ok, status: res.status, data: json };
  } catch (err) {
    console.warn(`[IslamQA] API unreachable at ${path}:`, err.message);
    return { ok: false, status: 0, data: null };
  }
}


/* ================================================================
   2. SEARCH
   — Tries the backend first (GET /search?q=...)
   — Falls back to the static SEARCH_INDEX if backend is offline
   ================================================================ */

/** Static fallback — always available even if backend is down */
const SEARCH_INDEX = [
  { type:'Article', category:'Aqeedah',     title:'The Six Pillars of Iman: A Foundational Understanding',        snippet:'Faith rests on six pillars: Allah, angels, books, messengers, Last Day, and divine decree.' },
  { type:'Article', category:'Fiqh',        title:'Purification (Taharah) in Islamic Law: A Comprehensive Guide', snippet:'Water types, conditions for wudu, ghusl, and tayammum across the four madhabs.' },
  { type:'Article', category:'Hadith',      title:'Understanding the Hadith of Jibreel: A Complete Exposition',   snippet:'The mother of all ahadith — Islam, Iman, and Ihsan in one narration.' },
  { type:'Article', category:'Tafsir',      title:'Tafsir of Surah Al-Fatiha: The Opening Chapter Explained',     snippet:'Seven verses that form the pillar of every prayer.' },
  { type:'Article', category:'Seerah',      title:'Lessons from the Migration to Madinah (Hijrah)',               snippet:'The Prophet ﷺ demonstrated unshakable trust in Allah during the Hijrah.' },
  { type:'Article', category:'Spirituality',title:'The Role of Tawakkul (Reliance on Allah) in Daily Life',       snippet:'True tawakkul balances taking means with placing trust in Allah.' },
  { type:'Q&A',     category:'Fiqh',        title:'Is it permissible to perform Salah while wearing shoes?',      snippet:'Yes, provided the shoes are pure. The Prophet ﷺ prayed in his shoes.' },
  { type:'Q&A',     category:'Fiqh',        title:'Ruling on missing Ramadan fasting due to illness',             snippet:'A valid excuse; make up the missed days after Ramadan when recovered.' },
  { type:'Q&A',     category:'Spirituality',title:'How do I know if my Tawbah has been accepted?',                snippet:'Signs: heart change, avoiding the sin, increased fear of Allah.' },
  { type:'Q&A',     category:'Fiqh',        title:'What is the nisab threshold for Zakah on gold and silver?',   snippet:'Gold: 85g, silver: 595g, after one lunar year.' },
  { type:'Q&A',     category:'Aqeedah',     title:'Is it correct to say that Allah is everywhere?',              snippet:'Scholars explain the correct Aqeedah position on this question.' },
  { type:'Article', category:'Aqeedah',     title:'Tawheed: The Oneness of Allah in Islamic Theology',           snippet:'Tawheed is divided into Rububiyyah, Uluhiyyah, and Asma wa Sifat.' },
];

/** Local filter — used when backend is offline */
function localSearch(rawQuery) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];
  return SEARCH_INDEX.filter(item =>
    item.title.toLowerCase().includes(q)    ||
    item.snippet.toLowerCase().includes(q)  ||
    item.category.toLowerCase().includes(q)
  );
}

/**
 * runSearch
 * Tries GET /search?q=... first.
 * If backend is unreachable, falls back to localSearch().
 *
 * @param {string} rawQuery - the search term
 * @returns {Promise<Array>} array of result objects
 */
async function runSearch(rawQuery) {
  if (!rawQuery.trim()) return [];

  const result = await apiFetch('/search?q=' + encodeURIComponent(rawQuery.trim()));

  if (result.ok && result.data && Array.isArray(result.data.data)) {
    // Backend returned results — normalise to the same shape as SEARCH_INDEX
    return result.data.data.map(item => ({
      type:     item.type === 'article' ? 'Article' : 'Q&A',
      category: item.category,
      title:    item.title,
      snippet:  item.excerpt || '',
    }));
  }

  // Backend offline or returned an error — use local fallback
  console.info('[IslamQA] Using local search fallback');
  return localSearch(rawQuery);
}

/** Render results into the search overlay list */
function renderSearchResults(results, query) {
  const container = document.getElementById('searchResults');
  if (!container) return;
  container.innerHTML = '';

  if (!results.length) {
    const empty = document.createElement('div');
    empty.className   = 'search-empty';
    empty.textContent = `No results found for "${query}". Try different keywords.`;
    container.appendChild(empty);
    return;
  }

  results.forEach(item => {
    const el   = document.createElement('div');
    el.className = 'search-result-item';
    el.setAttribute('role', 'listitem');

    const tag       = document.createElement('span');
    tag.className   = 'badge';
    tag.style.marginBottom = '6px';
    tag.textContent = item.category + ' · ' + item.type;

    const title       = document.createElement('h4');
    title.textContent = item.title;

    const snip        = document.createElement('p');
    snip.textContent  = item.snippet;

    el.appendChild(tag);
    el.appendChild(title);
    el.appendChild(snip);

    // Clicking a result closes the overlay
    el.addEventListener('click', closeSearchOverlay);
    container.appendChild(el);
  });
}

function openSearchOverlay() {
  const overlay = document.getElementById('searchOverlay');
  if (!overlay) return;
  overlay.classList.add('active');
  setTimeout(() => document.getElementById('overlay-search-input')?.focus(), 50);
}

function closeSearchOverlay() {
  document.getElementById('searchOverlay')?.classList.remove('active');
}


/* ================================================================
   3. ARTICLES — fetch from backend, render cards
   ================================================================ */

/**
 * buildArticleCard
 * Creates a single article card DOM element.
 * Uses escapeHtml() on all API data to prevent XSS.
 */
function buildArticleCard(article, featured = false) {
  const card     = document.createElement('article');
  card.className = featured ? 'article-card article-card-featured' : 'article-card';
  card.setAttribute('role', 'listitem');
  card.style.cursor = 'pointer';

  const stripMap = { Hadith: 'card-strip-teal', Tafsir: 'card-strip-gold' };
  const stripClass = stripMap[article.category] || '';

  // Safe: escapeHtml() is applied to every piece of API data
  card.innerHTML = `
    <div class="card-strip ${stripClass}"></div>
    <div class="card-content">
      <div class="card-top">
        <span class="badge">${escapeHtml(article.category)}</span>
        <span class="card-read">${escapeHtml(article.readTime || '')}</span>
      </div>
      <h3 class="card-title">${escapeHtml(article.title)}</h3>
      <p class="card-excerpt">${escapeHtml(article.excerpt)}</p>
      <div class="card-footer-row">
        <div class="card-author-row">
          <div class="avatar avatar-sm" aria-hidden="true">${getInitials(article.author)}</div>
          <div class="author-info-sm">
            <span class="author-name-sm">${escapeHtml(article.author)}</span>
          </div>
        </div>
        <span class="card-date">${formatDate(article.date)}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => { window.location.href = 'article.html'; });
  return card;
}

async function loadAndRenderArticles() {
  const grid    = document.getElementById('articles-grid');
  const loading = document.getElementById('articles-loading');
  if (!grid) return;

  const result   = await apiFetch('/articles');
  const articles = (result.ok && result.data?.data) ? result.data.data : getFallbackArticles();

  if (loading) loading.style.display = 'none';
  grid.style.display = 'grid';
  grid.innerHTML     = '';

  articles.forEach((article, i) => {
    grid.appendChild(buildArticleCard(article, i === 0));
  });
}

function getFallbackArticles() {
  return [
    { id:1, title:'The Six Pillars of Iman: A Foundational Understanding', category:'Aqeedah', author:'Sh. Ibrahim Al-Ansari', date:'2025-01-12', readTime:'8 min read', excerpt:'Faith in Islam rests upon six fundamental pillars — belief in Allah, His angels, His books, His messengers, the Last Day, and divine decree.' },
    { id:2, title:'Purification (Taharah) in Islamic Law', category:'Fiqh', author:'Sh. Muhammad Al-Kurdi', date:'2024-12-28', readTime:'12 min read', excerpt:'Purity is half of faith. This guide covers types of water, wudu, ghusl, and tayammum across the four madhabs.' },
    { id:3, title:'Understanding the Hadith of Jibreel', category:'Hadith', author:'Sh. Rania Al-Faris', date:'2025-01-05', readTime:'6 min read', excerpt:'The Hadith of Jibreel encapsulates the entire religion: Islam, Iman, and Ihsan explained in one narration.' },
    { id:4, title:'Tafsir of Surah Al-Fatiha', category:'Tafsir', author:'Sh. Ahmad Al-Qasim', date:'2025-01-19', readTime:'15 min read', excerpt:'Surah Al-Fatiha is the greatest surah. Its seven verses form the pillar of every prayer.' },
    { id:5, title:'Lessons from the Hijrah to Madinah', category:'Seerah', author:'Sh. Hassan Al-Nouri', date:'2025-02-03', readTime:'10 min read', excerpt:'The Hijrah marks a transformation in Islamic history. The Prophet ﷺ demonstrated unshakable trust in Allah.' },
    { id:6, title:'The Role of Tawakkul in Daily Life', category:'Spirituality', author:'Sh. Zahra Al-Mazroui', date:'2025-02-10', readTime:'7 min read', excerpt:'True tawakkul is the balance of taking means while placing ultimate trust in Allah.' },
  ];
}


/* ================================================================
   4. CATEGORIES — fetch from backend, update counts
   ================================================================ */

/**
 * loadAndUpdateCategories
 * Fetches GET /categories and updates the article count text
 * inside each existing category card.
 * The cards themselves are already in the HTML for fast initial load.
 */
async function loadAndUpdateCategories() {
  const result = await apiFetch('/categories');
  if (!result.ok || !result.data?.data) return; // stay with static HTML

  const categories = result.data.data;

  // Update each card's count text if the backend has a different number
  document.querySelectorAll('.category-card').forEach(card => {
    const nameEl = card.querySelector('.cat-name');
    const countEl = card.querySelector('.cat-count');
    if (!nameEl || !countEl) return;

    const cardName  = nameEl.textContent.trim().toLowerCase().replace(/[^a-z]/g, '');
    const matched   = categories.find(c =>
      c.name.toLowerCase().replace(/[^a-z]/g, '') === cardName
    );
    if (matched) {
      countEl.textContent = matched.articleCount + ' articles';
    }
  });
}


/* ================================================================
   5. Q&A — fetch from backend, build accordion dynamically
   ================================================================ */

/**
 * buildQAItem
 * Creates one accordion item from a question + its answers array.
 */
function buildQAItem(question, answers = []) {
  const item = document.createElement('div');
  item.className = 'qa-item';
  item.setAttribute('role', 'listitem');

  const answerId = `qa-ans-api-${question.id}`;

  // Question row
  const qRow       = document.createElement('div');
  qRow.className   = 'qa-question';
  qRow.tabIndex    = 0;
  qRow.setAttribute('role', 'button');
  qRow.setAttribute('aria-expanded', 'false');
  qRow.setAttribute('aria-controls', answerId);

  const qIcon       = document.createElement('div');
  qIcon.className   = 'qa-q-icon';
  qIcon.setAttribute('aria-hidden', 'true');
  qIcon.textContent = 'Q';

  const qText       = document.createElement('p');
  qText.className   = 'qa-q-text';
  qText.textContent = question.question; // textContent — safe, no XSS

  const toggleIcon       = document.createElement('span');
  toggleIcon.className   = 'qa-toggle-icon';
  toggleIcon.setAttribute('aria-hidden', 'true');
  toggleIcon.textContent = '+';

  qRow.appendChild(qIcon);
  qRow.appendChild(qText);
  qRow.appendChild(toggleIcon);

  // Answer panel
  const ansPanel     = document.createElement('div');
  ansPanel.className = 'qa-answer';
  ansPanel.id        = answerId;
  ansPanel.setAttribute('role', 'region');

  const ansBody      = document.createElement('div');
  ansBody.className  = 'qa-answer-body';

  if (answers.length > 0) {
    const firstAnswer = answers[0];

    const ansText        = document.createElement('p');
    ansText.className    = 'qa-answer-text';
    ansText.textContent  = firstAnswer.answer;

    const metaRow        = document.createElement('div');
    metaRow.className    = 'qa-answer-meta';

    const catBadge       = document.createElement('span');
    catBadge.className   = 'badge';
    catBadge.textContent = question.category;

    const scholarName        = document.createElement('span');
    scholarName.className    = 'scholar-name';
    scholarName.textContent  = firstAnswer.answeredBy;

    const dot           = document.createElement('span');
    dot.className       = 'hero-qcard-dot';

    const dateEl        = document.createElement('span');
    dateEl.className    = 'answer-date';
    dateEl.textContent  = formatDate(firstAnswer.createdAt);

    metaRow.appendChild(catBadge);
    metaRow.appendChild(scholarName);
    metaRow.appendChild(dot);
    metaRow.appendChild(dateEl);
    ansBody.appendChild(ansText);
    ansBody.appendChild(metaRow);
  } else {
    const pending        = document.createElement('p');
    pending.className    = 'qa-answer-text';
    pending.textContent  = 'This question is currently being reviewed by our scholars. Please check back soon.';
    ansBody.appendChild(pending);
  }

  ansPanel.appendChild(ansBody);
  item.appendChild(qRow);
  item.appendChild(ansPanel);

  // Wire up accordion toggle
  qRow.addEventListener('click', () => toggleQA(item));
  qRow.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleQA(item); }
  });

  return item;
}

/**
 * loadAndRenderQA
 * Fetches GET /questions, then for each answered question fetches
 * GET /answers/:id and builds the accordion dynamically.
 * Falls back gracefully to the existing static HTML if offline.
 */
async function loadAndRenderQA() {
  const list = document.getElementById('qaList');
  if (!list) return;

  const result = await apiFetch('/questions?status=answered');
  if (!result.ok || !result.data?.data) {
    // Backend offline — keep the static HTML already in the page
    attachStaticQAListeners();
    return;
  }

  const questions = result.data.data.slice(0, 5); // show max 5 on homepage

  // Fetch answers for all questions in parallel
  const answerPromises = questions.map(q => apiFetch(`/answers/${q.id}`));
  const answerResults  = await Promise.all(answerPromises);

  // Clear static HTML and replace with dynamic content
  list.innerHTML = '';

  questions.forEach((question, i) => {
    const ans     = answerResults[i];
    const answers = (ans.ok && ans.data?.data) ? ans.data.data : [];
    list.appendChild(buildQAItem(question, answers));
  });

  // Update the sidebar answered count
  const sidebarCount = document.getElementById('sidebar-answered');
  if (sidebarCount) {
    const total = result.data.count || questions.length;
    sidebarCount.textContent = total > 999 ? (total / 1000).toFixed(1) + 'k+' : total + '+';
  }
}

/** Attach accordion listeners to the static HTML Q&A items (offline fallback) */
function attachStaticQAListeners() {
  document.querySelectorAll('.qa-question').forEach(btn => {
    btn.addEventListener('click', () => toggleQA(btn.closest('.qa-item')));
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleQA(btn.closest('.qa-item'));
      }
    });
  });
}

/** Accordion toggle — opens one item, closes all others */
function toggleQA(item) {
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.qa-item.open').forEach(el => {
    el.classList.remove('open');
    el.querySelector('.qa-question')?.setAttribute('aria-expanded', 'false');
  });
  if (!isOpen) {
    item.classList.add('open');
    item.querySelector('.qa-question')?.setAttribute('aria-expanded', 'true');
  }
}


/* ================================================================
   6. ASK FORM — POST /questions
   ================================================================ */

function showFieldError(fieldId, message) {
  const el = document.getElementById('err-' + fieldId);
  if (el) { el.textContent = message; el.classList.add('visible'); }
}

function clearFieldErrors() {
  document.querySelectorAll('.form-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });
}

async function handleFormSubmit(event) {
  event.preventDefault();
  clearFieldErrors();

  const form       = event.target;
  const submitBtn  = document.getElementById('submitBtn');
  const questionEl = document.getElementById('q-question');
  const categoryEl = document.getElementById('q-category');
  const nameEl     = document.getElementById('q-name');

  // Client-side validation (backend also validates — this just gives instant feedback)
  let valid = true;
  if (!questionEl.value.trim() || questionEl.value.trim().length < 10) {
    showFieldError('question', 'Please write a question of at least 10 characters.');
    valid = false;
  }
  if (!categoryEl.value) {
    showFieldError('category', 'Please select a topic category.');
    valid = false;
  }
  if (!valid) return;

  submitBtn.disabled     = true;
  submitBtn.textContent  = 'Submitting…';

  const result = await apiFetch('/questions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      question:    questionEl.value.trim(),
      category:    categoryEl.value,
      submittedBy: nameEl?.value.trim() || 'Anonymous',
    }),
  });

  submitBtn.disabled = false;
  submitBtn.innerHTML = 'Submit Question <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

  if (result.ok) {
    form.reset();
    showToast('✓', 'Question submitted! A scholar will answer soon, in sha Allah.', 'success');
  } else if (result.status === 0) {
    form.reset();
    showToast('✓', 'Saved. Will be submitted when connection is restored.', 'success');
  } else {
    const errors = result.data?.errors || ['Submission failed. Please try again.'];
    showToast('✕', errors[0], 'error');
  }
}


/* ================================================================
   7. NAVIGATION
   ================================================================ */

function toggleNav() {
  const links  = document.getElementById('navLinks');
  const toggle = document.getElementById('navToggle');
  if (!links || !toggle) return;
  const open = links.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
}

function closeNavOnOutsideClick(e) {
  const header = document.querySelector('.site-header');
  const links  = document.getElementById('navLinks');
  if (links?.classList.contains('open') && header && !header.contains(e.target)) {
    links.classList.remove('open');
    document.getElementById('navToggle')?.setAttribute('aria-expanded', 'false');
  }
}


/* ================================================================
   8. TOAST NOTIFICATIONS
   ================================================================ */

let _toastTimer = null;

function showToast(icon, message, type = 'success') {
  const toast  = document.getElementById('toast');
  const iconEl = document.getElementById('toastIcon');
  const msgEl  = document.getElementById('toastMsg');
  if (!toast) return;

  if (_toastTimer) clearTimeout(_toastTimer);
  toast.className   = `toast toast-${type} visible`;
  if (iconEl) iconEl.textContent = icon;
  if (msgEl)  msgEl.textContent  = message;
  _toastTimer = setTimeout(() => toast.classList.remove('visible'), 5000);
}


/* ================================================================
   9. UTILITIES
   ================================================================ */

/** Prevent XSS — always use on data from API or user input before inserting to DOM */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Extract initials from a scholar name — strips "Sh." prefix */
function getInitials(name) {
  if (!name) return '??';
  return name
    .replace(/^Sh\.\s*/i, '')
    .split(' ').filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

/** Format an ISO date string to readable format: "5 Jan 2025" */
function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  } catch { return iso; }
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


/* ================================================================
   10. INIT — DOMContentLoaded
   All event listeners are registered here.
   No onclick or onkeydown attributes exist in the HTML.
   ================================================================ */

document.addEventListener('DOMContentLoaded', async function () {

  /* ── Load data from backend (parallel for speed) ── */
  loadAndRenderArticles();
  loadAndUpdateCategories();
  loadAndRenderQA();

  /* ── Navigation ── */
  document.getElementById('navToggle')?.addEventListener('click', toggleNav);
  document.addEventListener('click', closeNavOnOutsideClick);

  /* ── Hero search bar ── */
  const heroInput = document.getElementById('site-search');
  const heroBtn   = document.getElementById('searchBtn');

  async function triggerHeroSearch() {
    const q = heroInput?.value || '';
    if (!q.trim()) return;
    const results = await runSearch(q);
    const overlayInput = document.getElementById('overlay-search-input');
    if (overlayInput) overlayInput.value = q;
    renderSearchResults(results, q);
    openSearchOverlay();
  }

  heroBtn?.addEventListener('click', triggerHeroSearch);
  heroInput?.addEventListener('keydown', e => { if (e.key === 'Enter') triggerHeroSearch(); });

  /* ── Suggestion chips ── */
  document.querySelectorAll('.hero-chip').forEach(chip => {
    chip.addEventListener('click', async function () {
      const q = this.getAttribute('data-query') || this.textContent;
      if (heroInput) heroInput.value = q;
      const results = await runSearch(q);
      const overlayInput = document.getElementById('overlay-search-input');
      if (overlayInput) overlayInput.value = q;
      renderSearchResults(results, q);
      openSearchOverlay();
    });
  });

  /* ── Overlay search input (nav icon button) ── */
  document.getElementById('openSearchBtn')?.addEventListener('click', openSearchOverlay);
  document.getElementById('closeSearchBtn')?.addEventListener('click', closeSearchOverlay);

  document.getElementById('overlay-search-input')?.addEventListener('input', async function () {
    const results = await runSearch(this.value);
    renderSearchResults(results, this.value);
  });

  document.getElementById('searchOverlay')?.addEventListener('click', function (e) {
    if (e.target === this) closeSearchOverlay();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearchOverlay();
  });

  /* ── Ask form ── */
  document.getElementById('askForm')?.addEventListener('submit', handleFormSubmit);

  /* ── Category cards — click scrolls to articles ── */
  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', function () {
      const q = this.getAttribute('data-query') || this.querySelector('.cat-name')?.textContent;
      if (q && heroInput) heroInput.value = q;
      scrollTo('articles');
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });

  /* ── "Ask a Scholar" anchor links (smooth scroll) ── */
  document.querySelectorAll('a[href="#ask"]').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); scrollTo('ask'); });
  });

});
