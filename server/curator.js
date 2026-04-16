const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Flavor-specific prompt config ────────────────────────────

const FLAVOR_CONFIG = {
  digestino: {
    readerProfile: `Finance & Markets, Tech & AI, Crypto/Tokenization/Blockchain/DeFi, Business & Strategy, General News, and Soccer (especially Spanish La Liga and Atletico de Madrid).`,
    tone: `Direct, punchy, and data-driven. Lead with the numbers and the bottom line. Keep summaries tight — no fluff. The reader wants to know: what happened, why it matters, and what to watch next.`,
    digestSummaryStyle: `One sharp sentence capturing today's most important theme — written like a market close headline.`,
  },
  digestina: {
    readerProfile: `Lifestyle & Wellness, Fashion & Beauty, Personal Finance, Career & Business, Culture & Entertainment, Health, and World News — with a focus on how these topics impact everyday life.`,
    tone: `Warm, conversational, and engaging. Write like you're sharing great finds with a smart friend over coffee. Keep it informative but approachable — the reader wants to feel informed, not overwhelmed.`,
    digestSummaryStyle: `One warm, conversational sentence capturing the vibe of today's digest — like a friendly editor's note.`,
  },
};

/**
 * Uses Claude Haiku to curate a daily newsletter digest from raw newsletter data.
 * @param {Array} rawNewsletters
 * @param {Array} sources
 * @param {string} flavor — 'digestino' | 'digestina' (defaults to 'digestino')
 */
async function curateNewsletter(rawNewsletters, sources, flavor = 'digestino') {
  const config = FLAVOR_CONFIG[flavor] || FLAVOR_CONFIG.digestino;
  const editionName = flavor === 'digestina' ? 'The Digestina' : 'The Digestino';

  const contentSummary = rawNewsletters.map((nl, i) => {
    const storySummaries = nl.stories.map((s, j) => `  Story ${j + 1}: "${s.title}" - ${s.content.slice(0, 500)}`).join('\n');
    const snippetSummaries = nl.snippets.slice(0, 5).map((s, j) => `  Snippet ${j + 1}: ${s}`).join('\n');
    const imageSummaries = nl.images.map((img, j) => `  Image ${j + 1}: alt="${img.alt}", context="${img.context}"`).join('\n');

    return `
--- NEWSLETTER ${i + 1} ---
Source: ${nl.sourceName} (${nl.sourceEmail})
Subject: ${nl.subject}
Date: ${nl.date}

Stories:
${storySummaries || '  (none extracted)'}

Short snippets:
${snippetSummaries || '  (none)'}

Images/Visuals:
${imageSummaries || '  (none)'}

Full text excerpt:
${nl.fullText.slice(0, 1000)}
`;
  }).join('\n\n');

  const prompt = `You are curating ${editionName}, a daily newsletter digest.

The reader is interested in: ${config.readerProfile}

Your writing tone: ${config.tone}

Here are today's newsletters:

${contentSummary}

Create a curated daily digest following these STRICT rules:

1. **TOP STORIES** (max 4): Select the most important, interesting stories. Each must have:
   - A compelling headline written in the edition's tone
   - A 2-3 sentence summary capturing the key insight
   - The source name
   - NO duplicate or overlapping content between stories

2. **QUICK HITS** (max 4): Short items like interesting stats, quick takes, or "by the numbers" moments. Each should be 1-2 sentences max with source attribution.

3. **VISUALS** (max 3): If any newsletters contained notable charts, graphs, or visuals, include them with:
   - A brief description of what the visual shows
   - The image URL (if available)
   - The source

IMPORTANT:
- Do NOT meet maximums for the sake of it — only include genuinely relevant, interesting content
- NEVER repeat similar stories or themes across sections
- Prioritize uniqueness and reader value
- Discard promotional content, ads, and filler
- If a topic isn't interesting or relevant to this reader, skip it

digestSummary: ${config.digestSummaryStyle}

Respond in this exact JSON format:
{
  "topStories": [
    {
      "headline": "...",
      "summary": "...",
      "source": "...",
      "category": "finance|tech|crypto|business|news|sports|lifestyle|wellness|fashion|culture|health|career"
    }
  ],
  "quickHits": [
    {
      "text": "...",
      "source": "..."
    }
  ],
  "visuals": [
    {
      "description": "...",
      "imageUrl": "...",
      "source": "..."
    }
  ],
  "digestSummary": "..."
}

Return ONLY valid JSON, no markdown formatting or code blocks.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const digest = JSON.parse(jsonStr);
    digest.date = new Date().toISOString();
    digest.flavor = flavor;
    digest.sourcesUsed = rawNewsletters.map(nl => ({
      name: nl.sourceName,
      email: nl.sourceEmail,
      subject: nl.subject,
    }));

    return digest;
  } catch (err) {
    console.error('Curation error:', err);
    return createFallbackDigest(rawNewsletters, flavor);
  }
}

function createFallbackDigest(rawNewsletters, flavor = 'digestino') {
  const topStories = [];
  const seenTitles = new Set();

  for (const nl of rawNewsletters) {
    for (const story of nl.stories) {
      if (topStories.length >= 4) break;
      const titleLower = story.title.toLowerCase();
      if (seenTitles.has(titleLower)) continue;
      seenTitles.add(titleLower);
      topStories.push({
        headline: story.title,
        summary: story.content.slice(0, 200),
        source: nl.sourceName,
        category: 'news',
      });
    }
  }

  return {
    topStories,
    quickHits: [],
    visuals: [],
    digestSummary: 'Today\'s digest from your newsletter sources',
    date: new Date().toISOString(),
    flavor,
    sourcesUsed: rawNewsletters.map(nl => ({
      name: nl.sourceName,
      email: nl.sourceEmail,
      subject: nl.subject,
    })),
  };
}

module.exports = { curateNewsletter };
