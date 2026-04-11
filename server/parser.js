const cheerio = require('cheerio');

/**
 * Parse newsletter HTML into structured content blocks.
 * Extracts: headlines, story blocks, images/charts, and short snippets.
 */
function parseNewsletterHtml(html, subject) {
  const $ = cheerio.load(html);

  // Remove scripts, styles, and hidden elements
  $('script, style, [style*="display:none"], [style*="display: none"]').remove();

  const stories = [];
  const images = [];
  const snippets = [];

  // Extract images that look like charts/graphs/infographics
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    const width = parseInt($(el).attr('width') || '0', 10);

    // Filter for substantial images (likely charts/infographics, not icons/logos)
    if (width > 200 || src.match(/chart|graph|infographic|market|data|visual/i) || alt.match(/chart|graph|market|data/i)) {
      if (src.startsWith('http')) {
        images.push({
          url: src,
          alt: alt || 'Newsletter visual',
          context: $(el).closest('td, div, section').text().trim().slice(0, 200),
        });
      }
    }
  });

  // Try to find story blocks — newsletters typically use tables or divs with headers
  const headingEls = $('h1, h2, h3, h4, [class*="headline"], [class*="title"], [class*="heading"]');

  headingEls.each((_, el) => {
    const title = $(el).text().trim();
    if (!title || title.length < 5) return;

    // Get the content following this heading
    let content = '';
    let nextEl = $(el).next();

    // Collect text until next heading or substantial gap
    for (let i = 0; i < 5 && nextEl.length; i++) {
      const tagName = nextEl.prop('tagName')?.toLowerCase() || '';
      if (['h1', 'h2', 'h3', 'h4'].includes(tagName)) break;
      content += nextEl.text().trim() + ' ';
      nextEl = nextEl.next();
    }

    content = content.trim();
    if (content.length > 30) {
      stories.push({ title, content: content.slice(0, 1500) });
    }
  });

  // If heading-based extraction yielded nothing, try paragraph-based
  if (stories.length === 0) {
    const paragraphs = [];
    $('p, td').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 80) {
        paragraphs.push(text);
      }
    });

    // Group paragraphs into story-like blocks
    if (paragraphs.length > 0) {
      const fullText = paragraphs.join('\n\n');
      stories.push({ title: subject, content: fullText.slice(0, 3000) });
    }
  }

  // Extract short snippets (e.g., "by the numbers" style)
  $('li, [class*="stat"], [class*="number"], [class*="brief"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 15 && text.length < 200) {
      snippets.push(text);
    }
  });

  // Get full plain text as fallback
  const fullText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000);

  return {
    stories,
    images: images.slice(0, 5), // Cap raw images
    snippets: snippets.slice(0, 10),
    fullText,
  };
}

module.exports = { parseNewsletterHtml };
