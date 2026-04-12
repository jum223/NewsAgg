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
const { signToken, requireAuth, requireAdmin } = require('./auth');
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

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES (public)
// ═══════════════════════════════════════════════════════════════

// Validate an invite code (before starting OAuth)
app.post('/api/auth/validate-invite', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Invite code is required' });
  const invite = db.validateInviteCode(code.toUpperCase());
  if (!invite) return res.status(400).json({ error: 'Invalid or already used invite code' });
  res.json({ valid: true });
});

// Start Google OAuth flow
// Body: { inviteCode?: string } — required for new signups
app.post('/auth/google', (req, res) => {
  const { inviteCode } = req.body || {};
  const state = JSON.stringify({ inviteCode: inviteCode || '' });
  const url = getAuthUrl(state);
  res.json({ url });
});

// Also support GET for backward compat / simple redirects
app.get('/auth/google', (req, res) => {
  const url = getAuthUrl(JSON.stringify({ inviteCode: '' }));
  res.json({ url });
});

// OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const { tokens, userInfo } = await handleCallback(code);

    let parsedState = {};
    try { parsedState = JSON.parse(state || '{}'); } catch {}

    // Check if user exists
    let user = db.findUserByGoogleId(userInfo.googleId);

    if (!user) {
      // Check if this is the very first user — they get in without an invite (bootstrap)
      const allUsers = db.getAllUsers();
      const isFirst = allUsers.length === 0;

      const inviteCode = (parsedState.inviteCode || '').toUpperCase();

      if (!isFirst) {
        // Not the first user — require valid invite code
        if (!inviteCode) {
          return res.redirect(`${FRONTEND_URL || '/'}?auth=no-invite`);
        }
        const invite = db.validateInviteCode(inviteCode);
        if (!invite) {
          return res.redirect(`${FRONTEND_URL || '/'}?auth=invalid-invite`);
        }
      }

      // Create user
      user = db.createUser({
        googleId: userInfo.googleId,
        email: userInfo.email,
        name: userInfo.name,
        avatarUrl: userInfo.picture,
        isAdmin: isFirst,
      });

      // Redeem the invite code if one was used
      if (inviteCode && !isFirst) {
        db.redeemInviteCode(inviteCode, user.id);
      }
      console.log(`New user signed up: ${user.email} (admin: ${isFirst})`);
    } else {
      // Update profile info on login
      db.updateUser(user.id, { name: userInfo.name, avatar_url: userInfo.picture });
    }

    // Save Gmail tokens for this user
    db.saveTokens(user.id, tokens);

    // Generate JWT
    const jwt = signToken(user);

    // Redirect to frontend with the JWT
    res.redirect(`${FRONTEND_URL || '/'}?auth=success&token=${jwt}`);
  } catch (err) {
    console.error('Auth error:', err);
    res.redirect(`${FRONTEND_URL || '/'}?auth=error`);
  }
});

// Get current user info (requires auth)
app.get('/api/auth/me', requireAuth, (req, res) => {
  const { id, email, name, avatar_url, daily_cron_hour, is_admin, created_at } = req.user;
  const tokens = db.getTokens(id);
  res.json({
    id, email, name, avatar_url, daily_cron_hour,
    is_admin: !!is_admin,
    created_at,
    gmail_connected: !!tokens,
  });
});

// ═══════════════════════════════════════════════════════════════
// USER SETTINGS (requires auth)
// ═══════════════════════════════════════════════════════════════

app.put('/api/settings', requireAuth, (req, res) => {
  const { daily_cron_hour } = req.body;
  if (daily_cron_hour !== undefined) {
    const hour = parseInt(daily_cron_hour, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      return res.status(400).json({ error: 'Hour must be 0-23' });
    }
  }
  const updated = db.updateUser(req.user.id, req.body);
  res.json(updated);
});

// ═══════════════════════════════════════════════════════════════
// INVITE CODES (requires auth)
// ═══════════════════════════════════════════════════════════════

// Generate a new invite code (admin only)
app.post('/api/invites', requireAuth, requireAdmin, (req, res) => {
  const code = db.generateInviteCode(req.user.id);
  res.json({ code });
});

// List invite codes (admin sees all)
app.get('/api/invites', requireAuth, requireAdmin, (req, res) => {
  const codes = db.getInviteCodes(null); // null = admin sees all
  res.json(codes);
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.getAllUsers();
  res.json(users);
});

// ═══════════════════════════════════════════════════════════════
// SOURCE MANAGEMENT (requires auth)
// ═══════════════════════════════════════════════════════════════

app.get('/api/sources', requireAuth, (req, res) => {
  const sources = db.getSources(req.user.id);
  res.json(sources);
});

app.post('/api/sources', requireAuth, (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const source = db.addSource(req.user.id, email, name || email);
    res.json(source);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/sources/:id', requireAuth, (req, res) => {
  db.removeSource(req.user.id, req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// NEWSLETTER ROUTES (requires auth)
// ═══════════════════════════════════════════════════════════════

app.post('/api/newsletters/fetch', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sources = db.getSources(userId);
    if (sources.length === 0) {
      return res.status(400).json({ error: 'No newsletter sources configured' });
    }
    const tokens = db.getTokens(userId);
    if (!tokens) {
      return res.status(401).json({ error: 'Gmail not connected' });
    }
    console.log(`[${req.user.email}] Fetching newsletters from ${sources.length} sources...`);
    const rawNewsletters = await fetchNewsletters(sources, tokens);
    if (rawNewsletters.length === 0) {
      return res.json({ message: 'No new newsletters found', digest: null });
    }
    console.log(`[${req.user.email}] Found ${rawNewsletters.length} newsletters, curating...`);
    const digest = await curateNewsletter(rawNewsletters, sources);
    db.saveDigest(userId, digest);
    // Send email in background
    sendDigestEmail(digest, req.user.email).catch(err => console.error('Email error:', err));
    res.json({ message: 'Newsletter curated successfully', digest });
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/newsletters/latest', requireAuth, (req, res) => {
  const digest = db.getLatestDigest(req.user.id);
  res.json(digest);
});

app.get('/api/newsletters/history', requireAuth, (req, res) => {
  const digests = db.getDigests(req.user.id);
  res.json(digests);
});

app.get('/api/newsletters/:id', requireAuth, (req, res) => {
  const digest = db.getDigest(req.user.id, req.params.id);
  if (!digest) return res.status(404).json({ error: 'Digest not found' });
  res.json(digest);
});

// ═══════════════════════════════════════════════════════════════
// WEEKLY DIGEST ROUTES (requires auth)
// ═══════════════════════════════════════════════════════════════

app.post('/api/weekly/generate', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const dailyDigests = db.getRecentDailyDigests(userId, 7);
    if (dailyDigests.length === 0) {
      return res.status(400).json({ error: 'No daily digests found from the past 7 days' });
    }
    const result = await curateWeeklyDigest(dailyDigests);
    if (!result) {
      return res.status(500).json({ error: 'Weekly curation failed' });
    }
    db.saveWeeklyDigest(userId, result.weekStart, result.weekEnd, result.digest);
    sendWeeklyDigestEmail(result.digest, req.user.email).catch(err => console.error('Weekly email error:', err));
    res.json({ message: 'Weekly digest generated', digest: result.digest });
  } catch (err) {
    console.error('Weekly generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/weekly/latest', requireAuth, (req, res) => {
  const digest = db.getLatestWeeklyDigest(req.user.id);
  res.json(digest);
});

app.get('/api/weekly/history', requireAuth, (req, res) => {
  res.json(db.getWeeklyDigests(req.user.id));
});

app.get('/api/weekly/:id', requireAuth, (req, res) => {
  const digest = db.getWeeklyDigest(req.user.id, req.params.id);
  if (!digest) return res.status(404).json({ error: 'Not found' });
  res.json(digest);
});

// ═══════════════════════════════════════════════════════════════
// SPA CATCH-ALL
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// SCHEDULED CURATION — Per-user daily digests
// Runs every hour; checks which users have that hour as their
// preferred cron time (in Eastern Time).
// ═══════════════════════════════════════════════════════════════

cron.schedule('0 * * * *', async () => {
  // Get current hour in Eastern Time
  const now = new Date();
  const etHour = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }), 10);

  const users = db.getUsersByDailyCronHour(etHour);
  if (users.length === 0) return;

  console.log(`[Cron] ${etHour}:00 ET — Running daily digest for ${users.length} user(s)`);

  for (const user of users) {
    try {
      const sources = db.getSources(user.id);
      const tokens = db.getTokens(user.id);
      if (sources.length === 0 || !tokens) continue;

      console.log(`[Cron] Fetching for ${user.email}...`);
      const rawNewsletters = await fetchNewsletters(sources, tokens);
      if (rawNewsletters.length > 0) {
        const digest = await curateNewsletter(rawNewsletters, sources);
        db.saveDigest(user.id, digest);
        await sendDigestEmail(digest, user.email);
        console.log(`[Cron] Daily digest created for ${user.email}`);
      }
    } catch (err) {
      console.error(`[Cron] Failed for ${user.email}:`, err.message);
    }
  }
}, { timezone: 'America/New_York' });

// ═══════════════════════════════════════════════════════════════
// WEEKLY SUMMARY — Sundays at 9 AM Eastern for ALL users
// ═══════════════════════════════════════════════════════════════

cron.schedule('0 9 * * 0', async () => {
  console.log('[Cron] Running weekly digest for all users...');
  const allUsers = db.getAllUsers();

  for (const user of allUsers) {
    try {
      const dailyDigests = db.getRecentDailyDigests(user.id, 7);
      if (dailyDigests.length === 0) continue;

      const result = await curateWeeklyDigest(dailyDigests);
      if (result) {
        db.saveWeeklyDigest(user.id, result.weekStart, result.weekEnd, result.digest);
        await sendWeeklyDigestEmail(result.digest, user.email);
        console.log(`[Cron] Weekly digest created for ${user.email}`);
      }
    } catch (err) {
      console.error(`[Cron] Weekly failed for ${user.email}:`, err.message);
    }
  }
}, { timezone: 'America/New_York' });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`The Digestino running on port ${PORT} [${IS_PROD ? 'production' : 'development'}]`);
  if (IS_PROD) {
    const distExists = fs.existsSync(DIST_INDEX);
    console.log(`Client build: ${distExists ? 'found ✓' : 'NOT FOUND ✗ — check build logs'}`);
  }
  // Log user count on startup
  const users = db.getAllUsers();
  console.log(`Registered users: ${users.length}`);
});
