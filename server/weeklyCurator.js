const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Returns the Eastern-time date string for N days ago (YYYY-MM-DD).
 */
function easternDate(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Returns { weekStart, weekEnd } for the past 7 days in Eastern time.
 */
function getWeekRange() {
  return { weekStart: easternDate(6), weekEnd: easternDate(0) };
}

/**
 * Formats a YYYY-MM-DD string into "April 7, 2026"
 */
function formatDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

/**
 * Synthesizes the past week's daily digests into a top-5 weekly summary.
 */
async function curateWeeklyDigest(dailyDigests) {
  if (dailyDigests.length === 0) {
    return null;
  }

  const { weekStart, weekEnd } = getWeekRange();

  // Flatten all stories from all daily digests
  const allStories = [];
  const allQuickHits = [];

  dailyDigests.forEach(digest => {
    (digest.topStories || []).forEach(story => {
      allStories.push({ ...story, digestDate: digest.date });
    });
    (digest.quickHits || []).forEach(hit => {
      allQuickHits.push({ ...hit, digestDate: digest.date });
    });
  });

  const storiesText = allStories.map((s, i) =>
    `[${i + 1}] (${s.digestDate || ''}) Category: ${s.category}\nHeadline: ${s.headline}\nSummary: ${s.summary}\nSource: ${s.source}`
  ).join('\n\n');

  const hitsText = allQuickHits.map(h =>
    `• ${h.text} (${h.source})`
  ).join('\n');

  const prompt = `You are a senior editor creating a "Week in Review" digest.

The reader is interested in: Finance & Markets, Tech & AI, Crypto/Tokenization/Blockchain/DeFi, Business & Strategy, General News, and Soccer (especially Spanish La Liga and Atletico de Madrid).

Below are all the top stories from this past week's daily digests (${formatDate(weekStart)} – ${formatDate(weekEnd)}):

${storiesText}

${hitsText.length > 0 ? `Quick hits from the week:\n${hitsText}` : ''}

Your task: Write a "Week in Review" that captures the 5 most significant stories of the week. These should be the stories that will still matter next week — the ones with lasting impact, not just one-day news.

For each story:
- Write a sharper, more reflective headline (not just a summary)
- Explain WHY it was the story of the week and what it means going forward (2-3 sentences, more depth than the daily)
- Note which sources covered it
- Avoid duplicates — if two stories are about the same event, merge them into one

Also write a 2-sentence "week summary" capturing the overall theme or mood of the week.

Respond ONLY in this exact JSON format (no markdown, no code blocks):
{
  "weekOf": "${formatDate(weekStart)} – ${formatDate(weekEnd)}",
  "weekStart": "${weekStart}",
  "weekEnd": "${weekEnd}",
  "weekSummary": "...",
  "topStories": [
    {
      "rank": 1,
      "headline": "...",
      "whyItMatters": "...",
      "sources": ["Source A", "Source B"],
      "category": "finance|tech|crypto|business|news|sports"
    }
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const digest = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    digest.generatedAt = new Date().toISOString();
    return { weekStart, weekEnd, digest };
  } catch (err) {
    console.error('Weekly curation error:', err);
    return null;
  }
}

module.exports = { curateWeeklyDigest, getWeekRange };
