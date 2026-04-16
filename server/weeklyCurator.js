const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Flavor-specific weekly config ────────────────────────────

const WEEKLY_FLAVOR_CONFIG = {
  digestino: {
    readerProfile: `Finance & Markets, Tech & AI, Crypto/Tokenization/Blockchain/DeFi, Business & Strategy, General News, and Soccer (especially Spanish La Liga and Atletico de Madrid).`,
    tone: `Authoritative and direct. Think of a sharp weekly briefing — what moved markets, what shifted the landscape, what you need to know going into next week. Cut the noise.`,
    whyItMattersStyle: `Analytical and forward-looking. Why does this matter for the week ahead? What's the market or strategic implication?`,
    weekSummaryStyle: `Two punchy sentences capturing the week's dominant theme — written like a closing bell summary.`,
  },
  digestina: {
    readerProfile: `Lifestyle & Wellness, Fashion & Beauty, Personal Finance, Career & Business, Culture & Entertainment, Health, and World News.`,
    tone: `Reflective and warm. Think of a Sunday morning recap with a smart friend — what were the conversations worth having this week, what actually mattered, what you'll still be thinking about next week.`,
    whyItMattersStyle: `Personal and contextual. Why should the reader care? How does this affect their life, their decisions, or the culture around them?`,
    weekSummaryStyle: `Two warm sentences capturing the week's mood and most meaningful themes — like a thoughtful editor's Sunday note.`,
  },
};

function easternDate(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function getWeekRange() {
  return { weekStart: easternDate(6), weekEnd: easternDate(0) };
}

function formatDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

/**
 * Synthesizes the past week's daily digests into a top-5 weekly summary.
 * @param {Array} dailyDigests
 * @param {string} flavor — 'digestino' | 'digestina'
 */
async function curateWeeklyDigest(dailyDigests, flavor = 'digestino') {
  if (dailyDigests.length === 0) return null;

  const config = WEEKLY_FLAVOR_CONFIG[flavor] || WEEKLY_FLAVOR_CONFIG.digestino;
  const editionName = flavor === 'digestina' ? 'The Digestina' : 'The Digestino';
  const { weekStart, weekEnd } = getWeekRange();

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

  const hitsText = allQuickHits.map(h => `• ${h.text} (${h.source})`).join('\n');

  const prompt = `You are a senior editor creating the ${editionName} "Week in Review."

The reader is interested in: ${config.readerProfile}

Your writing tone: ${config.tone}

Below are all the top stories from this past week's daily digests (${formatDate(weekStart)} – ${formatDate(weekEnd)}):

${storiesText}

${hitsText.length > 0 ? `Quick hits from the week:\n${hitsText}` : ''}

Your task: Write a "Week in Review" capturing the 5 most significant stories of the week — the ones with lasting impact, not just one-day news.

For each story:
- Write a sharper, reflective headline in the edition's tone
- "whyItMatters": ${config.whyItMattersStyle} (2-3 sentences)
- Note which sources covered it
- Avoid duplicates — if two stories are about the same event, merge them

weekSummary: ${config.weekSummaryStyle}

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
      "category": "finance|tech|crypto|business|news|sports|lifestyle|wellness|fashion|culture|health|career"
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
    digest.flavor = flavor;
    return { weekStart, weekEnd, digest };
  } catch (err) {
    console.error('Weekly curation error:', err);
    return null;
  }
}

module.exports = { curateWeeklyDigest, getWeekRange };
