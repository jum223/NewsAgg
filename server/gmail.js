const { google } = require('googleapis');
const { parseNewsletterHtml } = require('./parser');
const db = require('./database');

// GMAIL_REDIRECT_URI must match what's registered in Google Cloud Console.
// For Railway: https://your-app.up.railway.app/auth/google/callback
// For local:   http://localhost:3001/auth/google/callback
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Combined scopes: identity (login) + Gmail reading
const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
];

/**
 * Generate auth URL for Google Sign-In + Gmail access.
 * @param {string} stateParam — JSON-encoded state (e.g. { inviteCode: 'ABC123' })
 */
function getAuthUrl(stateParam) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: stateParam || '',
  });
}

/**
 * Handle the OAuth callback.
 * Returns { tokens, userInfo } where userInfo has { googleId, email, name, picture }.
 */
async function handleCallback(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Fetch user profile from Google
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: profile } = await oauth2.userinfo.get();

  return {
    tokens,
    userInfo: {
      googleId: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    },
  };
}

/**
 * Set up credentials for a specific user's token set.
 * Returns a configured OAuth2 client for that user.
 */
function createUserOAuthClient(userTokens) {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  client.setCredentials({
    access_token: userTokens.access_token,
    refresh_token: userTokens.refresh_token,
    expiry_date: userTokens.expiry_date,
  });

  // Listen for token refresh events — persist updated tokens for this user
  client.on('tokens', (newTokens) => {
    db.saveTokens(userTokens.user_id, {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || userTokens.refresh_token,
      expiry_date: newTokens.expiry_date,
    });
  });

  return client;
}

async function fetchNewsletters(sources, userTokens) {
  const authClient = createUserOAuthClient(userTokens);
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  const newsletters = [];

  // Build query: from any of the registered source emails, last 24h
  const fromQuery = sources.map(s => `from:${s.email}`).join(' OR ');
  const after = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  const query = `(${fromQuery}) after:${after}`;

  try {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50,
    });

    const messages = listRes.data.messages || [];
    console.log(`Found ${messages.length} messages matching sources`);

    for (const msg of messages) {
      try {
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const headers = fullMsg.data.payload.headers;
        const from = headers.find(h => h.name === 'From')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Find matching source
        const source = sources.find(s => from.toLowerCase().includes(s.email.toLowerCase()));

        // Extract HTML body
        const htmlBody = extractHtmlBody(fullMsg.data.payload);
        if (!htmlBody) continue;

        // Parse the HTML into structured content
        const parsed = parseNewsletterHtml(htmlBody, subject);

        newsletters.push({
          messageId: msg.id,
          from,
          sourceName: source?.name || from,
          sourceEmail: source?.email || from,
          subject,
          date,
          ...parsed,
        });
      } catch (err) {
        console.error(`Error processing message ${msg.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Gmail API error:', err.message);
    throw err;
  }

  return newsletters;
}

function extractHtmlBody(payload) {
  // Check if the payload itself has HTML
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  // Recurse through parts
  if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractHtmlBody(part);
      if (result) return result;
    }
  }

  // Fallback to plain text
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  return null;
}

module.exports = { getAuthUrl, handleCallback, fetchNewsletters };
