require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { getAuthUrl, handleCallback, fetchNewsletters } = require('./gmail');
const { curateNewsletter } = require('./curator');
const { curateWeeklyDigest } = require('./weeklyCurator');
const { sendDigestEmail, sendWeeklyDigestEmail } = require('./emailer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

const FRONTEND_URL = IS_PROD
  ? process.env.APP_URL || ''
  : 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL || true }));
app.use(express.json());

// ─── Health check (Railway uses this to know the app is alive) ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React build in production
const DIST_PATH = path.join(__dirname, '../client/dist');
const DIST_INDEX = path.join(DIST_PATH, 'index.html');

if (IS_PROD) {
  app.use(express.static(DIST_PATH));
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

app.get('/api/sources', (req, res) => {
  const sources = db.getSources();
  res.json(sources);
});

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

app.delete('/api/sources/:id', (req, res) => {
  db.removeSource(req.params.id);
  res.json({ success: true });
});

// ─── Newsletter Routes ─────────────────────────────────────────

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
    db.saveDigest(digest);
    // Send email in background (don't await — don't block the API response)
    sendDigestEmail(digest).catch(err => console.error('Email error:', err));
    res.json({ message: 'Newsletter curated successfully', digest });
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/newsletters/latest', (req, res) => {
  const digest = db.getLatestDigest();
  res.json(digest);
});

app.get('/api/newsletters/history', (req, res) => {
  const digests = db.getDigests();
  res.json(digests);
});

app.get('/api/newsletters/:id', (req, res) => {
  const digest = db.getDigest(req.params.id);
  if (!digest) return res.status(404).json({ error: 'Digest not found' });
  res.json(digest);
});

// ─── Weekly Digest Routes ──────────────────────────────────────

// Manual trigger
app.post('/api/weekly/generate', async (req, res) => {
  try {
    const dailyDigests = db.getRecentDailyDigests(7);
    if (dailyDigests.length === 0) {
      return res.status(400).json({ error: 'No daily digests found from the past 7 days' });
    }
    const result = await curateWeeklyDigest(dailyDigests);
    if (!result) {
      return res.status(500).json({ error: 'Weekly curation failed' });
    }
    db.saveWeeklyDigest(result.weekStart, result.weekEnd, result.digest);
    sendWeeklyDigestEmail(result.digest).catch(err => console.error('Weekly email error:', err));
    res.json({ message: 'Weekly digest generated', digest: result.digest });
  } catch (err) {
    console.error('Weekly generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/weekly/latest', (req, res) => {
  const digest = db.getLatestWeeklyDigest();
  res.json(digest);
});

app.get('/api/weekly/history', (req, res) => {
  res.json(db.getWeeklyDigests());
});

app.get('/api/weekly/:id', (req, res) => {
  const digest = db.getWeeklyDigest(req.params.id);
  if (!digest) return res.status(404).json({ error: 'Not found' });
  res.json(digest);
});

// ─── Catch-all for SPA ─────────────────────────────────────────
// Only serve index.html if the build exists; otherwise return a useful error
if (IS_PROD) {
  app.get('*', (req, res) => {
    if (fs.existsSync(DIST_INDEX)) {
      res.sendFile(DIST_INDEX);
    } else {
      res.status(503).json({
        error: 'Frontend not built. Run "npm run build" first.',
        hint: 'Check Railway build logs for Vite errors.',
      });
    }
  });
}

// ─── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Scheduled curation (daily at 8 PM Eastern) ───────────────
cron.schedule('0 20 * * *', async () => {
  console.log('Running scheduled newsletter curation...');
  try {
    const sources = db.getSources();
    const tokens = db.getTokens();
    if (sources.length > 0 && tokens) {
      const rawNewsletters = await fetchNewsletters(sources, tokens);
      if (rawNewsletters.length > 0) {
        const digest = await curateNewsletter(rawNewsletters, sources);
        db.saveDigest(digest);
        await sendDigestEmail(digest);
        console.log('Daily digest created and emailed successfully');
      }
    }
  } catch (err) {
    console.error('Scheduled curation failed:', err);
  }
}, { timezone: 'America/New_York' });

// ─── Weekly summary (Sundays at 9 AM Eastern) ─────────────────
cron.schedule('0 9 * * 0', async () => {
  console.log('Running weekly digest curation...');
  try {
    const dailyDigests = db.getRecentDailyDigests(7);
    if (dailyDigests.length === 0) {
      console.log('No daily digests found for weekly summary');
      return;
    }
    const result = await curateWeeklyDigest(dailyDigests);
    if (result) {
      db.saveWeeklyDigest(result.weekStart, result.weekEnd, result.digest);
      await sendWeeklyDigestEmail(result.digest);
      console.log('Weekly digest created and emailed successfully');
    }
  } catch (err) {
    console.error('Weekly curation failed:', err);
  }
}, { timezone: 'America/New_York' });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`The Digestino running on port ${PORT} [${IS_PROD ? 'production' : 'development'}]`);
  if (IS_PROD) {
    const distExists = fs.existsSync(DIST_INDEX);
    console.log(`Client build: ${distExists ? 'found ✓' : 'NOT FOUND ✗ — check build logs'}`);
  }
});
