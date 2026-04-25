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

// ═══════════════════════════════════════════════════════════════
// PUBLIC LEGAL PAGES (no auth — required for Google verification)
// ═══════════════════════════════════════════════════════════════

function legalPage(title, bodyHtml) {
  const appUrl = process.env.APP_URL || 'https://newsagg-production.up.railway.app';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — The Digestino</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
           background: #faf9f7; color: #1a1a1a; line-height: 1.7; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 60px 24px 80px; }
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 48px; text-decoration: none; }
    .brand-dot { width: 36px; height: 36px; border-radius: 10px; background: #c2410c;
                 display: flex; align-items: center; justify-content: center;
                 color: #fff; font-weight: 800; font-size: 18px; }
    .brand-name { font-size: 20px; font-weight: 700; color: #1a1a1a; }
    h1 { font-size: 32px; font-weight: 800; margin-bottom: 8px; }
    .updated { font-size: 14px; color: #9a9a9a; margin-bottom: 40px; }
    h2 { font-size: 18px; font-weight: 700; margin: 36px 0 12px; color: #1a1a1a; }
    p, li { font-size: 15px; color: #4b4b4b; margin-bottom: 12px; }
    ul { padding-left: 20px; margin-bottom: 12px; }
    li { margin-bottom: 6px; }
    a { color: #c2410c; }
    .footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid #e8e5e0;
              font-size: 13px; color: #9a9a9a; }
    .footer a { color: #9a9a9a; }
  </style>
</head>
<body>
  <div class="wrap">
    <a class="brand" href="${appUrl}">
      <div class="brand-dot">d</div>
      <span class="brand-name">The Digestino</span>
    </a>
    ${bodyHtml}
    <div class="footer">
      <a href="${appUrl}/privacy">Privacy Policy</a> &nbsp;·&nbsp;
      <a href="${appUrl}/terms">Terms of Service</a> &nbsp;·&nbsp;
      <a href="${appUrl}">Back to app</a>
    </div>
  </div>
</body>
</html>`;
}

app.get('/privacy', (req, res) => {
  const lastUpdated = 'April 22, 2026';
  const contactEmail = 'juanmozosn19@gmail.com';
  const appUrl = process.env.APP_URL || 'https://newsagg-production.up.railway.app';

  res.send(legalPage('Privacy Policy', `
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: ${lastUpdated}</p>

    <p>The Digestino ("we", "our", or "us") is a personal newsletter aggregation service that connects to your Gmail inbox, reads newsletters from sources you choose, and uses AI to curate a single daily digest. This policy explains what data we collect, how we use it, and your rights.</p>

    <h2>1. Information We Collect</h2>
    <p>When you sign in with Google, we collect:</p>
    <ul>
      <li><strong>Google account information</strong> — your name, email address, and profile picture, provided by Google during sign-in.</li>
      <li><strong>Gmail messages</strong> — we access your Gmail inbox using read-only permission (<code>gmail.readonly</code>) solely to find and read newsletter emails from sources you have explicitly added. We do not read, store, or process any other emails in your inbox.</li>
      <li><strong>Usage data</strong> — your newsletter source preferences, digest schedule settings, and story ratings ("Goodies" and "Baddies") that you provide within the app.</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>To authenticate you and maintain your session.</li>
      <li>To fetch newsletter emails from sources you have chosen and generate your daily curated digest.</li>
      <li>To send your daily and weekly digest emails to your address.</li>
      <li>To improve digest quality over time using your story ratings.</li>
    </ul>
    <p>We do <strong>not</strong> sell, rent, or share your personal information with third parties for marketing purposes.</p>

    <h2>3. Third-Party Services</h2>
    <p>We use the following third-party services to operate The Digestino:</p>
    <ul>
      <li><strong>Google OAuth 2.0</strong> — for authentication and Gmail access. Governed by <a href="https://policies.google.com/privacy" target="_blank">Google's Privacy Policy</a>.</li>
      <li><strong>Anthropic Claude</strong> — newsletter content is sent to Anthropic's API to generate curated summaries. No personal account information is included. Governed by <a href="https://www.anthropic.com/privacy" target="_blank">Anthropic's Privacy Policy</a>.</li>
      <li><strong>Resend</strong> — used to deliver your daily digest emails. Governed by <a href="https://resend.com/legal/privacy-policy" target="_blank">Resend's Privacy Policy</a>.</li>
      <li><strong>Railway</strong> — our hosting provider, where your data is stored securely. Governed by <a href="https://railway.app/legal/privacy" target="_blank">Railway's Privacy Policy</a>.</li>
    </ul>

    <h2>4. Data Retention</h2>
    <p>We retain your account data and digest history for as long as your account is active. Newsletter email content is processed to generate digests and is not stored beyond what appears in your digest history. You may request deletion of your account and all associated data at any time by contacting us.</p>

    <h2>5. Data Security</h2>
    <p>Your Gmail OAuth tokens are stored securely and used solely to fetch newsletter emails on your behalf. We use industry-standard practices to protect your data. Access to your Gmail is limited to the <code>gmail.readonly</code> scope — we cannot read, modify, send, or delete your emails.</p>

    <h2>6. Your Rights</h2>
    <p>You may at any time:</p>
    <ul>
      <li>Revoke Gmail access by visiting <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a> and removing The Digestino.</li>
      <li>Request deletion of your account and all stored data by emailing us.</li>
      <li>Export or review your data by contacting us.</li>
    </ul>

    <h2>7. Children's Privacy</h2>
    <p>The Digestino is not directed at children under 13. We do not knowingly collect personal information from children under 13.</p>

    <h2>8. Changes to This Policy</h2>
    <p>We may update this policy from time to time. The "last updated" date at the top of this page will reflect any changes. Continued use of the service after changes constitutes acceptance of the updated policy.</p>

    <h2>9. Contact</h2>
    <p>If you have questions about this privacy policy or want to request data deletion, please contact us at: <a href="mailto:${contactEmail}">${contactEmail}</a></p>
  `));
});

app.get('/terms', (req, res) => {
  const lastUpdated = 'April 22, 2026';
  const contactEmail = 'juanmozosn19@gmail.com';

  res.send(legalPage('Terms of Service', `
    <h1>Terms of Service</h1>
    <p class="updated">Last updated: ${lastUpdated}</p>

    <p>By using The Digestino, you agree to these terms. Please read them carefully.</p>

    <h2>1. The Service</h2>
    <p>The Digestino is an AI-powered newsletter aggregation service. It connects to your Gmail inbox, reads newsletter emails from sources you choose, and generates a curated daily digest.</p>

    <h2>2. Your Account</h2>
    <p>You are responsible for maintaining the security of your account. The service is currently invite-only. You must not share your account with others or attempt to circumvent the invite system.</p>

    <h2>3. Acceptable Use</h2>
    <p>You agree to use The Digestino only for its intended purpose of aggregating your own newsletter subscriptions. You must not attempt to access other users' data or interfere with the service.</p>

    <h2>4. Gmail Access</h2>
    <p>By connecting your Gmail account, you authorize The Digestino to read (but not modify or delete) emails from newsletter sources you have added. You can revoke this access at any time via <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a>.</p>

    <h2>5. Disclaimer</h2>
    <p>The Digestino is provided "as is" without warranties of any kind. Digest content is AI-generated and may contain inaccuracies. We are not responsible for the content of third-party newsletters.</p>

    <h2>6. Contact</h2>
    <p>For questions about these terms, contact us at: <a href="mailto:${contactEmail}">${contactEmail}</a></p>
  `));
});

// ─── Google Search Console domain verification ──────────────────
// Replace GOOGLE_SITE_VERIFICATION env var with the filename Google gives you
// e.g. if filename is "google1234abcd.html", set GOOGLE_SITE_VERIFICATION=google1234abcd
const GSC_TOKEN = process.env.GOOGLE_SITE_VERIFICATION;
if (GSC_TOKEN) {
  app.get(`/${GSC_TOKEN}.html`, (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`google-site-verification: ${GSC_TOKEN}.html`);
  });
}

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

    // Reconnect flow: look up by userId from state (token refresh for existing user)
    if (parsedState.reconnect && parsedState.userId) {
      const existingUser = db.findUserById(parsedState.userId);
      if (!existingUser) return res.redirect(`${FRONTEND_URL || '/'}?auth=error`);
      db.saveTokens(existingUser.id, tokens);
      db.updateUser(existingUser.id, { gmail_token_invalid: 0 });
      const jwt = signToken(db.findUserById(existingUser.id));
      return res.redirect(`${FRONTEND_URL || '/'}?auth=success&token=${jwt}&reconnected=1`);
    }

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
      // Returning user — check if this is a Gmail reconnect
      if (parsedState.reconnect) {
        // Just refresh tokens and clear the invalid flag; don't change anything else
        db.saveTokens(user.id, tokens);
        db.updateUser(user.id, { gmail_token_invalid: 0 });
        const jwt = signToken(db.findUserById(user.id));
        return res.redirect(`${FRONTEND_URL || '/'}?auth=success&token=${jwt}&reconnected=1`);
      }
      // Normal login — update profile info
      db.updateUser(user.id, { name: userInfo.name, avatar_url: userInfo.picture });
    }

    // Save Gmail tokens for this user and clear any invalid flag
    db.saveTokens(user.id, tokens);
    db.updateUser(user.id, { gmail_token_invalid: 0 });

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
  const { id, email, name, avatar_url, daily_cron_hour, is_admin, flavor, created_at, gmail_token_invalid } = req.user;
  const tokens = db.getTokens(id);
  res.json({
    id, email, name, avatar_url, daily_cron_hour,
    is_admin: !!is_admin,
    flavor: flavor || null,
    created_at,
    gmail_connected: !!tokens,
    gmail_token_invalid: !!gmail_token_invalid,
  });
});

// Start a Gmail reconnect OAuth flow (for logged-in users with expired tokens)
app.post('/auth/google/reconnect', requireAuth, (req, res) => {
  const state = JSON.stringify({ reconnect: true, userId: req.user.id });
  const url = getAuthUrl(state);
  res.json({ url });
});

// ═══════════════════════════════════════════════════════════════
// USER SETTINGS (requires auth)
// ═══════════════════════════════════════════════════════════════

app.put('/api/settings', requireAuth, (req, res) => {
  const { daily_cron_hour, flavor } = req.body;
  if (daily_cron_hour !== undefined) {
    const hour = parseInt(daily_cron_hour, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      return res.status(400).json({ error: 'Hour must be 0-23' });
    }
  }
  if (flavor !== undefined && !['digestino', 'digestina'].includes(flavor)) {
    return res.status(400).json({ error: 'Invalid flavor' });
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

app.patch('/api/sources/:id', requireAuth, (req, res) => {
  const { min_stories } = req.body;
  if (min_stories !== undefined) {
    const clamped = Math.max(0, Math.min(2, parseInt(min_stories, 10) || 0));
    db.updateSource(req.user.id, req.params.id, { min_stories: clamped });
  }
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
    const flavor = req.user.flavor || 'digestino';
    const digest = await curateNewsletter(rawNewsletters, sources, flavor);
    const savedDigest = db.saveDigest(userId, digest);
    // Attach the DB id so rating links work
    const digestWithId = { ...digest, id: savedDigest?.id };
    // Send email in background
    sendDigestEmail(digestWithId, req.user.email, userId).catch(err => console.error('Email error:', err));
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
    const result = await curateWeeklyDigest(dailyDigests, req.user.flavor || 'digestino');
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
// STORY RATING ROUTES
// ═══════════════════════════════════════════════════════════════

// Web version — authenticated POST
app.post('/api/rate', requireAuth, (req, res) => {
  const { story_id, digest_id, rating, story_topic, story_source, story_headline } = req.body;
  if (!story_id) return res.status(400).json({ error: 'story_id required' });
  // rating=null means toggle off (remove)
  const validRating = rating === 'up' || rating === 'down' ? rating : null;
  const saved = db.saveRating({
    storyId: story_id,
    userId: req.user.id,
    digestId: digest_id ?? null,
    rating: validRating,
    source: 'web',
    storyTopic: story_topic ?? null,
    storySource: story_source ?? null,
    storyHeadline: story_headline ?? null,
  });
  res.json({ success: true, rating: saved?.rating ?? null });
});

// All ratings for the current user (for the Ratings history view)
app.get('/api/ratings', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;
  res.json(db.getRatings(req.user.id, { limit, offset }));
});

// Email version — unauthenticated GET link, returns a confirmation page
app.get('/rate', (req, res) => {
  const { sid, uid, did, r, topic, ss } = req.query;
  if (!sid || !uid || !r) {
    return res.status(400).send('<p>Invalid rating link.</p>');
  }
  const validRating = r === 'up' || r === 'down' ? r : null;
  if (!validRating) return res.status(400).send('<p>Invalid rating value.</p>');

  try {
    db.saveRating({
      storyId: sid,
      userId: parseInt(uid, 10),
      digestId: did ? parseInt(did, 10) : null,
      rating: validRating,
      source: 'email',
      storyTopic: topic ?? null,
      storySource: ss ?? null,
    });
  } catch (err) {
    console.error('Email rating error:', err.message);
  }

  const emoji = validRating === 'up' ? '👍' : '👎';
  const label = validRating === 'up' ? 'Goodie logged!' : 'Baddie noted.';
  const msg = validRating === 'up'
    ? "We'll surface more of this kind of content in future digests."
    : "We'll deprioritize similar content going forward.";
  const appUrl = process.env.APP_URL || 'https://newsagg-production.up.railway.app';

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${label}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
           background: #faf9f7; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; }
    .card { background: #fff; border: 1px solid #e8e5e0; border-radius: 16px;
            padding: 48px 40px; max-width: 420px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .emoji { font-size: 52px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 10px; }
    p { font-size: 15px; color: #6b6b6b; line-height: 1.6; margin-bottom: 28px; }
    a { display: inline-block; padding: 12px 28px; background: #c2410c; color: #fff;
        text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${emoji}</div>
    <h1>${label}</h1>
    <p>${msg}</p>
    <a href="${appUrl}">Back to your digest →</a>
  </div>
</body>
</html>`);
});

// Return existing ratings for a digest (used by web UI to restore state on load)
app.get('/api/rate/digest/:digestId', requireAuth, (req, res) => {
  const ratings = db.getRatingsByDigest(req.user.id, req.params.digestId);
  // Convert to { [story_id]: 'up'|'down' } map for easy lookup
  const map = {};
  for (const r of ratings) map[r.story_id] = r.rating;
  res.json(map);
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
        const digest = await curateNewsletter(rawNewsletters, sources, user.flavor || 'digestino');
        const savedDigest = db.saveDigest(user.id, digest);
        const digestWithId = { ...digest, id: savedDigest?.id };
        await sendDigestEmail(digestWithId, user.email, user.id);
        console.log(`[Cron] Daily digest created for ${user.email}`);
      }
    } catch (err) {
      console.error(`[Cron] Failed for ${user.email}:`, err.message);
      // If the token is revoked/expired, flag the account so the UI can prompt reconnect
      if (err.message?.includes('invalid_grant') || err.message?.includes('Token has been expired')) {
        db.updateUser(user.id, { gmail_token_invalid: 1 });
        console.warn(`[Cron] Gmail token flagged as invalid for ${user.email} — user must reconnect`);
      }
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

      const result = await curateWeeklyDigest(dailyDigests, user.flavor || 'digestino');
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
