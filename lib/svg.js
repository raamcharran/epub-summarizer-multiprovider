// SVG generation — chapter infographic helpers
import { generateText, getAiConfig, describeAiConfig } from './ai.js';
import { escapeHtml } from './util.js';

const CONCURRENCY = parseInt(process.env.AI_CONCURRENCY || '3', 10);

const SVG_SYSTEM = `You are an expert SVG infographic designer. Given a book chapter's content, generate a single self-contained SVG infographic that visually represents the chapter's key ideas.

Rules:
- Output ONLY the SVG element — no explanation, no markdown, no code fences
- Start with <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 360" style="width:100%;font-family:'Inter',sans-serif">
- The very first child must be <rect width="760" height="360" fill="#182828"/> to set the dark background
- End with </svg>
- Use a DIFFERENT layout type for each chapter — choose the most appropriate:
  * Flowchart: for sequential processes or decision trees
  * Timeline: for historical progression or steps over time
  * Two-column contrast: for comparing opposing ideas
  * Hub-and-spoke: for one central concept with radiating sub-concepts
  * Hierarchy/pyramid: for ranked or layered frameworks
  * Cycle diagram: for iterative or feedback-loop concepts
  * Force/outcome diagram: for cause-effect relationships
  * Icon grid: for a list of principles or rules
- Color palette: background #182828, panel #1e2e2e, border #253535, accent #ff6b4a (coral), heading text #eee, body text #888
- CRITICAL text rules: minimum font-size 10px, keep any single label under 22 chars, use <tspan> to wrap longer text across multiple lines, NEVER let text extend beyond its containing rect — use clipPath if needed
- Make it feel like a dark editorial infographic, not a node-link map
- Always include:
  * a header panel (fill="#1e2e2e") spanning the full width with a 2px coral left border, containing the chapter title and a one-line thesis
  * 3-5 content blocks on the dark background, each with fill="#1e2e2e" stroke="#253535", coral accent details
  * a footer panel (fill="#1e2e2e") with a key quote or takeaway
- NO external images or fonts — pure SVG shapes and text only
- The SVG must be visually rich and informative, not generic`;

function stripCodeFences(text) {
  return String(text || '')
    .replace(/^```(?:svg)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

// Strip <script> tags and on* event handlers from AI-generated SVG before
// embedding inline in HTML — inline SVGs can execute JS via these vectors.
function sanitizeSvg(svg) {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '');
}

async function generateSvgWithAi(prompt, config) {
  const svg = sanitizeSvg(stripCodeFences(await generateText({
    system: SVG_SYSTEM,
    prompt,
    maxTokens: 4000,
    config,
  })));
  if (svg.includes('<svg') && svg.includes('</svg>')) return svg;
  throw new Error('Model did not return SVG');
}

export async function generateChapterSvg(chapter, analysis, options = {}) {
  const config = options.config || getAiConfig();
  const conceptList = (analysis.concepts || []).map(c => `- ${c.label}: ${c.description}`).join('\n');
  const edgeList = (analysis.concept_edges || []).map(e => `${e.from} -> ${e.to} (${e.label})`).join('\n');

  const prompt = `Chapter: "${chapter.title}"
Coverage type: ${analysis.coverage_type || 'reference'}
Summary (first 600 chars): ${(analysis.summary || '').slice(0, 600)}
Key concepts:
${conceptList}
Concept relationships:
${edgeList}

Generate the SVG infographic now:`;

  try {
    return await generateSvgWithAi(prompt, config);
  } catch {
    return fallbackSvg(chapter, analysis);
  }
}

export function truncate(text, length) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  return value.length > length ? `${value.slice(0, length - 1).trim()}…` : value;
}

function firstSentence(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const match = clean.match(/.+?[.!?](?:\s|$)/);
  return truncate(match ? match[0].trim() : clean, 180);
}

export function wrapLines(text, maxChars, maxLines) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let current = '';
  let usedWords = 0;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
      usedWords += 1;
      continue;
    }

    lines.push(current);
    current = word;
    usedWords += 1;
    if (lines.length === maxLines - 1) break;
  }

  if (lines.length < maxLines && current) lines.push(current);
  if (usedWords < words.length && lines.length) lines[lines.length - 1] = truncate(lines[lines.length - 1], maxChars);
  if (usedWords < words.length && lines.length && !lines[lines.length - 1].endsWith('…')) lines[lines.length - 1] += '…';
  return lines;
}

export function renderTextLines(lines, x, y, lineHeight, attrs = '') {
  if (!lines.length) return '';
  return `<text x="${x}" y="${y}" ${attrs}>${lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${escapeHtml(line)}</tspan>`).join('')}</text>`;
}

export function coveragePalette(type) {
  const map = {
    core_argument: { accent: '#c8a84b', panel: '#2a1f0a', label: 'Core Argument' },
    illustrative: { accent: '#1a7a4a', panel: '#0d2218', label: 'Illustrative' },
    background: { accent: '#6ea3d1', panel: '#102338', label: 'Background' },
    reference: { accent: '#6b7b90', panel: '#162333', label: 'Reference' },
  };
  return map[type] || map.reference;
}

export function coverageBadge(type) {
  const map = {
    core_argument: 'Core Argument',
    illustrative: 'Illustrative',
    background: 'Background',
    reference: 'Reference',
  };
  return map[type] || 'Reference';
}

export function fallbackSvg(chapter, analysis) {
  const W = 760;
  const H = 360;
  // Unique prefix per chapter so inline SVG IDs don't collide across chapters
  const pfx = (chapter.id || 'ch').replace(/[^a-z0-9]/gi, '');
  const coverageLabel = coverageBadge(analysis.coverage_type);
  const thesis = firstSentence(analysis.summary) || truncate(chapter.title, 100);
  const quote = truncate((analysis.key_quotes || [])[0] || 'Key quote unavailable.', 110);
  const rawConcepts = (analysis.concepts || []).slice(0, 3);
  const cards = rawConcepts.length ? rawConcepts : [
    { label: 'Main Thread', description: truncate(thesis, 110) },
    { label: 'Chapter Role', description: `Categorized as ${coverageLabel.toLowerCase()} content.` },
    { label: 'Reading Signal', description: 'Refer to the prose summary below for full context.' },
  ];

  // Layout: 3 cards max, evenly spaced
  const cardCount = Math.min(cards.length, 3);
  const cardW = 185;
  const cardH = 134;
  const margin = 22;
  const cardGap = Math.floor((W - 2 * margin - cardCount * cardW) / (cardCount + 1));
  const cardY = 136;

  // clipPath per card prevents text overflowing box bounds
  const clipDefs = Array.from({ length: cardCount }, (_, i) =>
    `<clipPath id="${pfx}c${i}"><rect width="${cardW - 4}" height="${cardH - 10}"/></clipPath>`
  ).join('');

  const connectors = Array.from({ length: cardCount - 1 }, (_, i) => {
    const x1 = margin + cardGap + i * (cardW + cardGap) + cardW;
    const x2 = margin + cardGap + (i + 1) * (cardW + cardGap);
    const midY = cardY + cardH / 2;
    return `<line x1="${x1}" y1="${midY}" x2="${x2}" y2="${midY}" stroke="#ff6b4a" stroke-width="1.5" stroke-opacity="0.4" marker-end="url(#${pfx}a)"/>`;
  }).join('');

  const cardSvgs = cards.slice(0, cardCount).map((concept, i) => {
    const cx = margin + cardGap + i * (cardW + cardGap);
    const titleLines = wrapLines(concept.label || `Idea ${i + 1}`, 22, 2);
    const descLines = wrapLines(concept.description || '', 28, 5);
    return `
    <g transform="translate(${cx},${cardY})">
      <rect width="${cardW}" height="${cardH}" fill="#1e2e2e" stroke="#253535" stroke-width="1"/>
      <rect width="2" height="${cardH}" fill="#ff6b4a" fill-opacity="0.7"/>
      <g clip-path="url(#${pfx}c${i})" transform="translate(2,5)">
        ${renderTextLines(titleLines, 10, 18, 16, 'font-size="12.5" font-weight="800" fill="#eee"')}
        ${renderTextLines(descLines, 10, 46, 13, 'font-size="10" fill="#888"')}
      </g>
    </g>`;
  }).join('');

  const titleLines = wrapLines(chapter.title, 64, 2);
  const thesisLines = wrapLines(thesis, 92, 2);
  const quoteLines = wrapLines(quote, 88, 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;font-family:'Inter',sans-serif">
  <defs>
    <pattern id="${pfx}d" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1" fill="#253535"/>
    </pattern>
    <marker id="${pfx}a" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L7,3 z" fill="#ff6b4a" fill-opacity="0.5"/>
    </marker>
    ${clipDefs}
  </defs>
  <rect width="${W}" height="${H}" fill="#182828"/>
  <rect width="${W}" height="${H}" fill="url(#${pfx}d)"/>
  <rect width="${W}" height="122" fill="#1e2e2e"/>
  <rect width="2" height="122" fill="#ff6b4a"/>
  <text x="14" y="20" font-size="9" font-weight="700" fill="#ff6b4a" letter-spacing="2.5">${escapeHtml(coverageLabel.toUpperCase())}</text>
  ${renderTextLines(titleLines, 14, 48, 22, 'font-size="19" font-weight="900" fill="#eee"')}
  ${renderTextLines(thesisLines, 14, 86, 14, 'font-size="11" fill="#888"')}
  ${connectors}
  ${cardSvgs}
  <rect y="${H - 50}" width="${W}" height="50" fill="#1e2e2e"/>
  <rect y="${H - 50}" width="2" height="50" fill="#ff6b4a"/>
  <text x="14" y="${H - 27}" font-size="9" font-weight="700" fill="#ff6b4a" letter-spacing="2.5">KEY SIGNAL</text>
  ${renderTextLines(quoteLines, 108, H - 27, 14, 'font-size="10.5" fill="#888"')}
</svg>`;
}

async function generateSvgBatch(chapters, analyses, config) {
  process.stdout.write(`  Generating ${chapters.length} chapter infographics (${CONCURRENCY} parallel)...\n`);
  process.stdout.write(`  SVG provider: ${describeAiConfig(config)}\n`);

  const svgs = [];
  for (let i = 0; i < chapters.length; i += CONCURRENCY) {
    const batch = chapters.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((ch, j) => {
        process.stdout.write(`    [${i + j + 1}/${chapters.length}] ${ch.title.slice(0, 40)}\n`);
        return generateChapterSvg(ch, analyses[i + j] || {}, { config });
      })
    );
    svgs.push(...results);
  }
  process.stdout.write('  All infographics done.\n');
  return svgs;
}

export async function prepareChapterSvgs(chapters, analyses, options = {}) {
  const { cachedSvgs = [], svgs = null, generateSvgs = true } = options;
  const config = options.config || getAiConfig();
  const sourceSvgs = Array.isArray(svgs) ? svgs : cachedSvgs;
  const initialSvgs = Array.isArray(sourceSvgs) ? [...sourceSvgs] : [];

  if (!generateSvgs) {
    return chapters.map((chapter, i) => initialSvgs[i] || fallbackSvg(chapter, analyses[i] || {}));
  }

  const missingIndexes = chapters
    .map((_, i) => i)
    .filter(i => !initialSvgs[i]);

  if (missingIndexes.length === 0) return initialSvgs.slice(0, chapters.length);

  const generated = await generateSvgBatch(
    missingIndexes.map(i => chapters[i]),
    missingIndexes.map(i => analyses[i] || {}),
    config
  );

  missingIndexes.forEach((chapterIndex, generatedIndex) => {
    initialSvgs[chapterIndex] = generated[generatedIndex];
  });

  return initialSvgs.slice(0, chapters.length);
}
