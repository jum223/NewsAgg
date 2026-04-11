require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { getAuthUrl, handleCallback, fetchNewsletters } = require('./gmail');
const { curateNewsletter } = require('./curator');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

const FRONTEND_URL = process.env.NODE_ENV === 'production'
  ? process.env.APP_URL || ''
  : 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL || true }));
app.use(express.json());

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// ─── Auth Routes ───────────────────────────────────────────────

// Start Gmail OAuth flow
app.get('/auth/google', (req, res) => {
  const url = getAuthUrl();
  res.json({ url });
});

// OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    await handleCallback(code);
    // Redirect to frontend
    res.redirect(`${FRONTEND_URL || '/'}?auth=success`);
  } catch (err) {
    console.error('Auth error:', err);
    res.redirect(`${FRONTEND_URL || '/'}?auth=error`);
  }
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
  const tokens = db.getTokens();
  res.json({ authenticated: !!tokens });
});

// ─── Source Management Routes ──────────────────────────────────

// Get all newsletter sources
app.get('/api/sources', (req, res) => {
  const sources = db.getSources();
  res.json(sources);
});

// Add a newsletter source
app.post('/api/sources', (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const source = db.addSource(email, name || email);
    res.json(source);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Remove a newsletter source
app.delete('/api/sources/:id', (req, res) => {
  db.removeSource(req.params.id);
  res.json({ success: true });
});

// ─── Newsletter Routes ─────────────────────────────────────────

// Fetch and curate newsletters (manual trigger)
app.post('/api/newsletters/fetch', async (req, res) => {
  try {
    const sources = db.getSources();
    if (sources.length === 0) {
      return res.status(400).json({ error: 'No newsletter sources configured' });
    }

    const tokens = db.getTokens();
    if (!tokens) {
      return res.status(401).json({ error: 'Gmail not connected' });
    }

    console.log(`Fetching newsletters from ${sources.length} sources...`);
    const rawNewsletters = await fetchNewsletters(sources, tokens);

    if (rawNewsletters.length === 0) {
      return res.json({ message: 'No new newsletters found', digest: null });
    }

    console.log(`Found ${rawNewsletters.length} newsletters, curating...`);
    const digest = await curateNewsletter(rawNewsletters, sources);

    // Save digest
    db.saveDigest(digest);

    res.json({ message: 'Newsletter curated successfully', digest });
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get latest digest
app.get('/api/newsletters/latest', (req, res) => {
  const digest = db.getLatestDigest();
  res.json(digest);
});

// Get all digests
app.get('/api/newsletters/history', (req, res) => {
  const digests = db.getDigests();
  res.json(digests);
});

// Get a specific digest
app.get('/api/newsletters/:id', (req, res) => {
  const digest = db.getDigest(req.params.id);
  if (!digest) return res.status(404).json({ error: 'Digest not found' });
  res.json(digest);
});

// ─── Catch-all for SPA ─────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// ─── Scheduled curation (daily at 7 AM) ────────────────────────
cron.schedule('0 7 * * *', async () => {
  console.log('Running scheduled newsletter curation...');
  try {
    const sources = db.getSources();
    const tokens = db.getTokens();
    if (sources.length > 0 && tokens) {
      const rawNewsletters = await fetchNewsletters(sources, tokens);
      if (rawNewsletters.length > 0) {
        const digest = await curateNewsletter(rawNewsletters, sources);
        db.saveDigest(digest);
        console.log('Daily digest created successfully');
      }
    }
  } catch (err) {
    console.error('Scheduled curation failed:', err);
  }
});

app.listen(PORT, () => {
  console.log(`Newsletter Aggregator server running on http://localhost:${PORT}`);
});
