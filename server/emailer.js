const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FLAVOR_EMAIL = {
  digestino: {
    name: 'The Digestino',
    brand: '#c2410c',
    brandHover: '#9a3412',
    tagline: 'Curated by AI · Daily',
  },
  digestina: {
    name: 'The Digestina',
    brand: '#be185d',
    brandHover: '#9d174d',
    tagline: 'Curated with care · Daily',
  },
};

const categoryEmoji = {
  finance: '📈',
  tech: '💻',
  crypto: '₿',
  business: '💼',
  news: '🌐',
  sports: '⚽',
  lifestyle: '✨',
  wellness: '🌿',
  fashion: '👗',
  culture: '🎨',
  health: '💚',
  career: '🚀',
};

const categoryColor = {
  finance: '#10b981',
  tech: '#6366f1',
  crypto: '#f59e0b',
  business: '#3b82f6',
  news: '#8b5cf6',
  sports: '#ef4444',
  lifestyle: '#ec4899',
  wellness: '#22c55e',
  fashion: '#a855f7',
  culture: '#f97316',
  health: '#14b8a6',
  career: '#6366f1',
};

function formatEmailDate(isoStr) {
  const clean = (isoStr || '').split('T')[0];
  const [y, m, d] = clean.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function buildEmailHtml(digest, appUrl) {
  const { topStories = [], quickHits = [], visuals = [], digestSummary, sourcesUsed = [], date, flavor } = digest;
  const formattedDate = formatEmailDate(date);
  const viewUrl = appUrl || 'https://newsagg-production.up.railway.app';
  const f = FLAVOR_EMAIL[flavor] || FLAVOR_EMAIL.digestino;

  const storiesHtml = topStories.map(story => {
    const emoji = categoryEmoji[story.category] || '📰';
    const color = categoryColor[story.category] || '#6b7280';
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px; border:1px solid #e8e5e0; border-radius:12px; overflow:hidden; background:#ffffff;">
      <tr>
        <td style="padding:24px;">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:${color}; margin-bottom:10px;">
            ${emoji} ${story.category}
          </div>
          <div style="font-family:Georgia, serif; font-size:20px; font-weight:700; color:#1a1a1a; line-height:1.35; margin-bottom:10px;">
            ${escapeHtml(story.headline)}
          </div>
          <div style="font-size:14px; color:#6b6b6b; line-height:1.7; margin-bottom:14px;">
            ${escapeHtml(story.summary)}
          </div>
          <div style="font-size:12px; color:#9a9a9a; font-weight:600;">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${color}; margin-right:6px; vertical-align:middle;"></span>
            ${escapeHtml(story.source)}
          </div>
        </td>
      </tr>
    </table>`;
  }).join('');

  const quickHitsHtml = quickHits.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      ${quickHits.map((hit, i) => `
      <tr>
        <td style="padding:14px 20px; background:#ffffff; border:1px solid #e8e5e0; border-radius:8px; margin-bottom:8px; display:block;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="32" valign="top">
                <div style="width:28px; height:28px; border-radius:50%; background:#eff6ff; color:#2563eb; font-size:12px; font-weight:700; text-align:center; line-height:28px; flex-shrink:0;">
                  ${i + 1}
                </div>
              </td>
              <td style="padding-left:12px;">
                <div style="font-size:14px; color:#1a1a1a; line-height:1.6; margin-bottom:4px;">${escapeHtml(hit.text)}</div>
                <div style="font-size:12px; color:#9a9a9a; font-weight:500;">${escapeHtml(hit.source)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td height="8"></td></tr>
      `).join('')}
    </table>` : '';

  const visualsHtml = visuals.length > 0 ? `
    ${visuals.map(v => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px; border:1px solid #e8e5e0; border-radius:8px; overflow:hidden; background:#ffffff;">
      <tr>
        <td style="padding:16px 20px;">
          <div style="font-size:13px; color:#6b6b6b; line-height:1.55; margin-bottom:6px;">${escapeHtml(v.description)}</div>
          <div style="font-size:11px; color:#9a9a9a; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">${escapeHtml(v.source)}</div>
        </td>
      </tr>
    </table>`).join('')}` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${f.name} — ${formattedDate}</title>
</head>
<body style="margin:0; padding:0; background:#faf9f7; font-family:-apple-system, BlinkMacSystemFont, 'Inter', sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="text-align:center; padding-bottom:32px; border-bottom:1px solid #e8e5e0;">
              <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:${f.brand}; margin-bottom:8px;">
                ${formattedDate}
              </div>
              <div style="font-family:Georgia, serif; font-size:32px; font-weight:700; color:#1a1a1a; margin-bottom:12px; line-height:1.2;">
                ${f.name}
              </div>
              ${digestSummary ? `<div style="font-size:15px; color:#6b6b6b; line-height:1.6; max-width:460px; margin:0 auto 12px;">${escapeHtml(digestSummary)}</div>` : ''}
              <div style="font-size:12px; color:#9a9a9a;">
                Curated from: ${sourcesUsed.map(s => escapeHtml(s.name)).join(' · ')}
              </div>
            </td>
          </tr>

          <tr><td height="32"></td></tr>

          ${topStories.length > 0 ? `
          <!-- Top Stories -->
          <tr>
            <td>
              <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6b6b6b; padding-bottom:12px; border-bottom:2px solid #e8e5e0; margin-bottom:20px;">
                ⚡ Top Stories
              </div>
              ${storiesHtml}
            </td>
          </tr>
          <tr><td height="16"></td></tr>
          ` : ''}

          ${quickHits.length > 0 ? `
          <!-- Quick Hits -->
          <tr>
            <td>
              <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6b6b6b; padding-bottom:12px; border-bottom:2px solid #e8e5e0; margin-bottom:20px;">
                📊 Quick Hits
              </div>
              ${quickHitsHtml}
            </td>
          </tr>
          <tr><td height="16"></td></tr>
          ` : ''}

          ${visuals.length > 0 ? `
          <!-- Visuals -->
          <tr>
            <td>
              <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6b6b6b; padding-bottom:12px; border-bottom:2px solid #e8e5e0; margin-bottom:20px;">
                🖼 Charts & Visuals
              </div>
              ${visualsHtml}
            </td>
          </tr>
          <tr><td height="16"></td></tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="text-align:center; padding-top:32px; border-top:1px solid #e8e5e0;">
              <a href="${viewUrl}" style="display:inline-block; padding:12px 28px; background:${f.brand}; color:#ffffff; text-decoration:none; border-radius:8px; font-size:14px; font-weight:600; margin-bottom:20px;">
                View in App →
              </a>
              <div style="font-size:12px; color:#9a9a9a; line-height:1.6;">
                ${f.name} · ${f.tagline}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send daily digest email.
 * @param {object} digest — the curated digest content
 * @param {string} recipientEmail — the user's email address
 */
async function sendDigestEmail(digest, recipientEmail) {
  if (!process.env.RESEND_API_KEY) {
    console.log('Email skipped: RESEND_API_KEY not set');
    return;
  }
  const toEmail = recipientEmail || process.env.DIGEST_EMAIL;
  if (!toEmail) {
    console.log('Email skipped: no recipient email');
    return;
  }

  const appUrl = process.env.APP_URL || 'https://newsagg-production.up.railway.app';
  const html = buildEmailHtml(digest, appUrl);
  const dateLabel = formatEmailDate(digest.date);
  const f = FLAVOR_EMAIL[digest.flavor] || FLAVOR_EMAIL.digestino;
  const fromDefault = `${f.name} <onboarding@resend.dev>`;

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || fromDefault,
      to: toEmail,
      subject: `${f.name} — ${dateLabel}`,
      html,
    });
    console.log(`Digest email sent to ${toEmail}:`, result.data?.id || 'ok');
  } catch (err) {
    console.error('Failed to send digest email:', err.message);
  }
}

function buildWeeklyEmailHtml(digest, appUrl) {
  const { weekOf, weekSummary, topStories = [], flavor } = digest;
  const viewUrl = appUrl || 'https://newsagg-production.up.railway.app';
  const f = FLAVOR_EMAIL[flavor] || FLAVOR_EMAIL.digestino;

  const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  const storiesHtml = topStories.map((story, i) => {
    const color = categoryColor[story.category] || '#6b7280';
    const emoji = categoryEmoji[story.category] || '📰';
    const sources = (story.sources || []).join(', ');
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px; border:1px solid #e8e5e0; border-radius:12px; overflow:hidden; background:#ffffff; border-left:4px solid ${color};">
      <tr>
        <td style="padding:24px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
            <span style="font-size:22px;">${rankEmoji[i] || `${i + 1}.`}</span>
            <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:${color};">${emoji} ${story.category}</span>
          </div>
          <div style="font-family:Georgia, serif; font-size:20px; font-weight:700; color:#1a1a1a; line-height:1.35; margin-bottom:12px;">
            ${escapeHtml(story.headline)}
          </div>
          <div style="font-size:14px; color:#4b5563; line-height:1.75; margin-bottom:14px; background:#f9fafb; padding:14px 16px; border-radius:8px;">
            ${escapeHtml(story.whyItMatters)}
          </div>
          ${sources ? `<div style="font-size:12px; color:#9a9a9a; font-weight:600;">Covered by: ${escapeHtml(sources)}</div>` : ''}
        </td>
      </tr>
    </table>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Week in Review — ${escapeHtml(weekOf)}</title>
</head>
<body style="margin:0; padding:0; background:#faf9f7; font-family:-apple-system, BlinkMacSystemFont, 'Inter', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="text-align:center; padding-bottom:32px; border-bottom:1px solid #e8e5e0;">
              <div style="display:inline-block; background:linear-gradient(135deg,#f59e0b,#d97706); color:#ffffff; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:2px; padding:4px 14px; border-radius:20px; margin-bottom:16px;">
                Week in Review
              </div>
              <div style="font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:1.5px; color:#9a9a9a; margin-bottom:8px;">
                ${escapeHtml(weekOf)}
              </div>
              <div style="font-family:Georgia, serif; font-size:30px; font-weight:700; color:#1a1a1a; margin-bottom:12px; line-height:1.2;">
                The 5 Stories That Mattered
              </div>
              ${weekSummary ? `<div style="font-size:15px; color:#6b6b6b; line-height:1.7; max-width:480px; margin:0 auto;">${escapeHtml(weekSummary)}</div>` : ''}
            </td>
          </tr>

          <tr><td height="32"></td></tr>

          <!-- Stories -->
          <tr>
            <td>
              <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6b6b6b; padding-bottom:12px; border-bottom:2px solid #e8e5e0; margin-bottom:20px;">
                🏆 Top Stories of the Week
              </div>
              ${storiesHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align:center; padding-top:32px; border-top:1px solid #e8e5e0;">
              <a href="${viewUrl}" style="display:inline-block; padding:12px 28px; background:${f.brand}; color:#ffffff; text-decoration:none; border-radius:8px; font-size:14px; font-weight:600; margin-bottom:20px;">
                View in App →
              </a>
              <div style="font-size:12px; color:#9a9a9a; line-height:1.6;">
                ${f.name} · Week in Review · Every Sunday at 9 AM ET
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send weekly digest email.
 * @param {object} digest — the weekly digest content
 * @param {string} recipientEmail — the user's email address
 */
async function sendWeeklyDigestEmail(digest, recipientEmail) {
  if (!process.env.RESEND_API_KEY) {
    console.log('Weekly email skipped: RESEND_API_KEY not set');
    return;
  }
  const toEmail = recipientEmail || process.env.DIGEST_EMAIL;
  if (!toEmail) {
    console.log('Weekly email skipped: no recipient email');
    return;
  }
  const appUrl = process.env.APP_URL || 'https://newsagg-production.up.railway.app';
  const html = buildWeeklyEmailHtml(digest, appUrl);
  const fw = FLAVOR_EMAIL[digest.flavor] || FLAVOR_EMAIL.digestino;
  const fromDefaultWeekly = `${fw.name} <onboarding@resend.dev>`;
  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || fromDefaultWeekly,
      to: toEmail,
      subject: `${fw.name} — Week in Review — ${digest.weekOf || 'This Week'}`,
      html,
    });
    console.log(`Weekly digest email sent to ${toEmail}:`, result.data?.id || 'ok');
  } catch (err) {
    console.error('Failed to send weekly digest email:', err.message);
  }
}

module.exports = { sendDigestEmail, sendWeeklyDigestEmail };
