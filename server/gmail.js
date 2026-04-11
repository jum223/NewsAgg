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

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

async function handleCallback(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  db.saveTokens(tokens);
  return tokens;
}

function setCredentials(tokens) {
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  // Listen for token refresh events
  oauth2Client.on('tokens', (newTokens) => {
    db.saveTokens({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokens.refresh_token,
      expiry_date: newTokens.expiry_date,
    });
  });
}

async function fetchNewsletters(sources, tokens) {
  setCredentials(tokens);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

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
      // Skip already-processed messages
      if (db.isMessageFetched(msg.id)) continue;

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

        db.markMessageFetched(msg.id);
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
