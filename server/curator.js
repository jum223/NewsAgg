const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Uses Claude Haiku to curate a daily newsletter digest from raw newsletter data.
 * Selects the most relevant, non-duplicate stories and formats them.
 */
async function curateNewsletter(rawNewsletters, sources) {
  // Build a summary of all available content for the AI
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

  const prompt = `You are an expert newsletter curator. Your job is to create ONE polished daily digest from multiple newsletter sources.

The reader is interested in: Finance & Markets, Tech & AI, Crypto/Tokenization/Blockchain/DeFi, Business & Strategy, General News, and Soccer (especially Spanish La Liga and Atletico de Madrid).

Here are today's newsletters:

${contentSummary}

Create a curated daily digest following these STRICT rules:

1. **TOP STORIES** (max 4): Select the most important, interesting stories. Each must have:
   - A compelling headline
   - A 2-3 sentence summary capturing the key insight
   - The source name in parentheses
   - NO duplicate or overlapping content between stories

2. **QUICK HITS** (max 4): Short, punchy items like "by the numbers", interesting stats, quick takes. Each should be 1-2 sentences max with source attribution.

3. **VISUALS** (max 3): If any newsletters contained notable charts, graphs, or market visuals, include them with:
   - A brief description of what the visual shows
   - The image URL (if available)
   - The source

IMPORTANT:
- Do NOT meet maximums for the sake of it — only include genuinely relevant, interesting content
- NEVER repeat similar stories or themes across sections
- Prioritize uniqueness and reader value
- Discard promotional content, ads, and filler
- If a topic isn't interesting or relevant, skip it

Respond in this exact JSON format:
{
  "topStories": [
    {
      "headline": "...",
      "summary": "...",
      "source": "...",
      "category": "finance|tech|crypto|business|news|sports"
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
  "digestSummary": "One sentence describing today's overall theme/mood"
}

Return ONLY valid JSON, no markdown formatting or code blocks.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();

    // Try to parse JSON, handling potential markdown wrapping
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const digest = JSON.parse(jsonStr);

    // Add metadata
    digest.date = new Date().toISOString();
    digest.sourcesUsed = rawNewsletters.map(nl => ({
      name: nl.sourceName,
      email: nl.sourceEmail,
      subject: nl.subject,
    }));

    return digest;
  } catch (err) {
    console.error('Curation error:', err);

    // Fallback: return a basic digest without AI curation
    return createFallbackDigest(rawNewsletters);
  }
}

function createFallbackDigest(rawNewsletters) {
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
    sourcesUsed: rawNewsletters.map(nl => ({
      name: nl.sourceName,
      email: nl.sourceEmail,
      subject: nl.subject,
    })),
  };
}

module.exports = { curateNewsletter };
