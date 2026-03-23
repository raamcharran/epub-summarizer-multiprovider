#!/usr/bin/env node
/**
 * book — EPUB to interactive visual summary CLI
 *
 * Commands:
 *   ingest <path>       Parse EPUB + build RAG index + AI analysis → cached to library
 *   list                Show all books in library
 *   explain <title>     Render HTML from cached analysis (no live model calls)
 *   search <query>      Full-text TF-IDF search across all books in library
 *   info <title>        Show book metadata and cache status
 */
import path from 'path';
import fs from 'fs';
import os from 'os';
import { EPub } from 'epub2';
import { buildIndex, query } from './lib/rag.js';
import { analyzeAllChapters, synthesize } from './lib/analyze.js';
import { renderHtml, buildMarkdown, prepareChapterSvgs } from './lib/render.js';
import { save, load, exists, saveOutput, listBooks, findBook, resolveBookSlug, bookDir, LIBRARY_DIR } from './lib/library.js';
import { getAiConfig, describeAiConfig } from './lib/ai.js';

const CONCURRENCY = parseInt(process.env.AI_CONCURRENCY || '3', 10);

// Analysis runs through a provider abstraction: Claude CLI, Anthropic, OpenAI, or OpenAI-compatible APIs

// ── Config validation ─────────────────────────────────────────────────────────

function validateAiConfig(config) {
  if (config.provider === 'anthropic' && !config.anthropicApiKey) {
    console.error([
      '',
      'Error: ANTHROPIC_API_KEY is not set.',
      '',
      'Set it before running:',
      '  export ANTHROPIC_API_KEY=sk-ant-...',
      '',
      'Or switch to OpenAI:',
      '  export OPENAI_API_KEY=sk-...',
      '',
      'See PROVIDERS.md for all setup options.',
      '',
    ].join('\n'));
    process.exit(1);
  }
  if ((config.provider === 'openai' || config.provider === 'openai-compatible') && !config.openAiApiKey) {
    console.error([
      '',
      'Error: OPENAI_API_KEY is not set.',
      '',
      'Set it before running:',
      '  export OPENAI_API_KEY=sk-...',
      '',
      'See PROVIDERS.md for all setup options.',
      '',
    ].join('\n'));
    process.exit(1);
  }
}

function printEstimate(chapters, config) {
  const totalCalls = chapters.length * 2 + 1; // analyses + SVGs + synthesis
  const estMin = Math.max(2, Math.ceil((totalCalls * 12) / 60));
  const model = config.provider === 'claude-cli' ? 'Claude CLI session' : `${config.provider} / ${config.model}`;
  console.log(`  AI calls needed:  ~${totalCalls} (${chapters.length} analyses + ${chapters.length} SVGs + 1 synthesis)`);
  console.log(`  Estimated time:   ~${estMin}–${estMin * 2} min (varies by provider/network)`);
  console.log(`  Model:            ${model}\n`);
}

// ── EPUB parser ───────────────────────────────────────────────────────────────

function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

function wordCount(t) { return t.split(/\s+/).filter(Boolean).length; }

function parseEpub(filePath) {
  return new Promise((resolve, reject) => {
    const epub = new EPub(filePath, path.join(os.tmpdir(), 'epub-img'));
    epub.on('error', err => {
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes('encrypted') || msg.toLowerCase().includes('drm')) {
        reject(new Error('This EPUB appears to be DRM-protected. Remove DRM before ingesting.'));
      } else {
        reject(err);
      }
    });
    epub.on('end', async () => {
      const meta = {
        title:  epub.metadata.title  || path.basename(filePath, '.epub'),
        author: epub.metadata.creator || epub.metadata.author || 'Unknown',
      };

      if (!epub.flow?.length) {
        reject(new Error('EPUB has no readable spine/flow. The file may be malformed or DRM-protected.'));
        return;
      }

      const chapters = [];
      let skipped = 0;
      for (let i = 0; i < epub.flow.length; i++) {
        const item = epub.flow[i];
        try {
          const raw = await new Promise((res, rej) =>
            epub.getChapter(item.id, (err, t) => err ? rej(err) : res(t || '')));
          const text = stripHtml(raw);
          if (wordCount(text) < 200) { skipped++; continue; }
          const title = item.title || `Chapter ${chapters.length + 1}`;
          chapters.push({ id: `ch_${i}`, title: title.trim(), text, wordCount: wordCount(text) });
        } catch { skipped++; /* skip unreadable sections */ }
      }

      if (chapters.length === 0) {
        const hint = skipped > 0
          ? `All ${skipped} sections were too short or unreadable. The EPUB may be DRM-protected, image-only, or use an unsupported format.`
          : 'No readable sections found.';
        reject(new Error(`Could not extract any chapters from this EPUB. ${hint}`));
        return;
      }

      if (chapters.length > 60) {
        console.warn(`  Warning: ${chapters.length} chapters detected. This will take a long time and make many API calls.`);
        console.warn('  Consider setting FORCE_REBUILD=1 only for stages you need to regenerate.\n');
      }

      resolve({ meta, chapters });
    });
    epub.parse();
  });
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdIngest(epubPath) {
  const aiConfig = getAiConfig();
  const forceRebuild = process.env.FORCE_REBUILD === '1';
  const absPath = path.resolve(epubPath);

  if (!absPath.toLowerCase().endsWith('.epub')) {
    console.error(`Error: File does not appear to be an EPUB: ${absPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  validateAiConfig(aiConfig);

  console.log(`\nParsing: ${absPath}`);
  const { meta, chapters } = await parseEpub(absPath);

  if (chapters.length === 0) {
    console.error('Error: No chapters found after filtering. The EPUB may be image-only, DRM-protected, or have very short chapters.');
    process.exit(1);
  }

  if (chapters.length > 40) {
    console.warn(`Warning: ${chapters.length} chapters detected. Large books may use significant memory and take 30+ minutes. Consider processing in sections if you experience issues.`);
  }

  const slug = resolveBookSlug(meta.title, meta.author);
  console.log(`  Title:    ${meta.title}`);
  console.log(`  Author:   ${meta.author}`);
  console.log(`  Chapters: ${chapters.length}`);
  console.log(`  Slug:     ${slug}\n`);
  if (forceRebuild) console.log('Force rebuild: enabled\n');

  const hasCachedAnalyses = !forceRebuild && exists(slug, 'analyses');
  const hasCachedSynthesis = !forceRebuild && exists(slug, 'synthesis');
  const hasCachedSvgs = !forceRebuild && exists(slug, 'svgs');
  const allCached = hasCachedAnalyses && hasCachedSynthesis && hasCachedSvgs;

  if (!allCached) {
    printEstimate(chapters, aiConfig);
  }

  // Save raw chapters
  save(slug, 'chapters', { meta, chapters });

  // Build RAG index
  console.log('Building RAG index...');
  const index = buildIndex(chapters);
  save(slug, 'rag-index', index);
  console.log(`  ${index.meta.totalChunks} chunks, ${index.meta.vocabSize} vocab terms\n`);

  // Run chapter analyses (check cache first)
  let analyses;
  if (hasCachedAnalyses) {
    console.log('Chapter analyses already cached — skipping API calls.');
    analyses = load(slug, 'analyses');
  } else {
    console.log('Analyzing chapters...');
    analyses = await analyzeAllChapters(chapters, index, { config: aiConfig });
    save(slug, 'analyses', analyses);
    console.log('  Chapter analyses cached.');
  }

  // Run synthesis (check cache first)
  let synthesis;
  if (hasCachedSynthesis) {
    console.log('Synthesis already cached — skipping API call.');
    synthesis = load(slug, 'synthesis');
  } else {
    console.log('\nSynthesizing...');
    synthesis = await synthesize(chapters, analyses, index, { config: aiConfig });
    save(slug, 'synthesis', synthesis);
    console.log('  Synthesis cached.');
  }

  let svgs;
  if (hasCachedSvgs) {
    console.log('Chapter infographics already cached — skipping live model calls.');
    svgs = load(slug, 'svgs');
  } else {
    console.log('\nGenerating chapter infographics...');
    svgs = await prepareChapterSvgs(chapters, analyses, { config: aiConfig });
    save(slug, 'svgs', svgs);
    console.log('  Chapter infographics cached.');
  }

  // Save meta with synthesis fields for convenience
  const fullMeta = { slug, title: meta.title, author: meta.author, ingestedAt: new Date().toISOString(),
    chapterCount: chapters.length, ragChunks: index.meta.totalChunks, vocabSize: index.meta.vocabSize,
    central_claim: synthesis.central_claim, book_summary: synthesis.book_summary };
  save(slug, 'meta', fullMeta);

  // Render HTML
  console.log('\nRendering HTML...');
  const html = await renderHtml(fullMeta, chapters, analyses, synthesis, { svgs, generateSvgs: false });
  const md   = buildMarkdown(fullMeta, chapters, analyses);
  const htmlPath = saveOutput(slug, 'summary.html', html);
  const mdPath   = saveOutput(slug, 'summary.md', md);

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`\nDone! Book saved to library as "${slug}"`);
  console.log(`  HTML: ${htmlPath}  (${kb} KB)`);
  console.log(`  MD:   ${mdPath}\n`);
}

function cmdList() {
  const books = listBooks();
  if (books.length === 0) {
    console.log('\nLibrary is empty. Run:  node book.js ingest <path.epub>\n');
    return;
  }
  console.log(`\n${'─'.repeat(72)}`);
  console.log(` BOOK LIBRARY  (${books.length} book${books.length === 1 ? '' : 's'})`);
  console.log(`${'─'.repeat(72)}`);
  for (const b of books) {
    const cached = exists(b.slug, 'analyses') && exists(b.slug, 'synthesis');
    const status = cached ? '✓ cached' : '⚠ partial';
    console.log(`\n  ${b.title}`);
    console.log(`  Author: ${b.author}  |  Chapters: ${b.chapterCount}  |  RAG chunks: ${b.ragChunks}  |  ${status}`);
    console.log(`  Slug: ${b.slug}  |  Ingested: ${b.ingestedAt?.slice(0, 10) || 'unknown'}`);
  }
  console.log(`\n${'─'.repeat(72)}\n`);
}

async function cmdExplain(title) {
  const book = findBook(title);
  if (!book) {
    console.error(`Book not found: "${title}"\nRun "node book.js list" to see available books.`);
    process.exit(1);
  }

  console.log(`\nExplaining: ${book.title}`);

  const { chapters } = load(book.slug, 'chapters');
  const analyses  = load(book.slug, 'analyses');
  const synthesis = load(book.slug, 'synthesis');
  const cachedSvgs = load(book.slug, 'svgs') || [];

  if (!analyses || !synthesis) {
    console.error('Book is not fully analysed. Re-run: node book.js ingest <path>');
    process.exit(1);
  }

  if (cachedSvgs.length) {
    console.log('Rendering HTML from cached analysis and cached infographics (no live model calls)...');
  } else {
    console.log('Rendering HTML from cached analysis with local fallback infographics (no live model calls)...');
  }

  const svgs = await prepareChapterSvgs(chapters, analyses, { cachedSvgs, generateSvgs: false });
  if (svgs.length !== cachedSvgs.length) save(book.slug, 'svgs', svgs);

  const html = await renderHtml(book, chapters, analyses, synthesis, { svgs, generateSvgs: false });
  const md   = buildMarkdown(book, chapters, analyses);
  const htmlPath = saveOutput(book.slug, 'summary.html', html);
  const mdPath   = saveOutput(book.slug, 'summary.md', md);

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`\nDone!`);
  console.log(`  HTML: ${htmlPath}  (${kb} KB)`);
  console.log(`  MD:   ${mdPath}\n`);
}

function cmdSearch(queryStr) {
  const books = listBooks();
  if (books.length === 0) { console.log('Library is empty.'); return; }

  console.log(`\nSearching "${queryStr}" across ${books.length} book(s)...\n`);
  const allResults = [];

  for (const book of books) {
    const index = load(book.slug, 'rag-index');
    if (!index) continue;
    const hits = query(index, queryStr, 3);
    hits.forEach(h => allResults.push({ ...h, bookTitle: book.title, bookSlug: book.slug }));
  }

  allResults.sort((a, b) => b.score - a.score);
  const top = allResults.slice(0, 10);

  if (top.length === 0) { console.log('No results found.'); return; }

  top.forEach((r, i) => {
    console.log(`${'─'.repeat(72)}`);
    console.log(`[${i + 1}] ${r.bookTitle}  —  ${r.chapter}  (score: ${r.score.toFixed(3)})`);
    console.log(`\n${r.text.slice(0, 350)}${r.text.length > 350 ? '…' : ''}\n`);
  });
  console.log(`${'─'.repeat(72)}\n`);
}

function cmdInfo(title) {
  const book = findBook(title);
  if (!book) {
    console.error(`Book not found: "${title}"`);
    process.exit(1);
  }
  const dir = bookDir(book.slug);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(` ${book.title}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Author:       ${book.author}`);
  console.log(`  Slug:         ${book.slug}`);
  console.log(`  Ingested:     ${book.ingestedAt?.slice(0, 19).replace('T', ' ') || 'unknown'}`);
  console.log(`  Chapters:     ${book.chapterCount}`);
  console.log(`  RAG chunks:   ${book.ragChunks}  |  Vocab: ${book.vocabSize}`);
  console.log(`  Cached:       chapters=${exists(book.slug,'chapters')} analyses=${exists(book.slug,'analyses')} synthesis=${exists(book.slug,'synthesis')} svgs=${exists(book.slug,'svgs')}`);
  console.log(`  Library dir:  ${dir}`);
  console.log(`\n  Central claim:`);
  console.log(`  ${(book.central_claim || '').slice(0, 200)}…`);
  console.log(`${'─'.repeat(60)}\n`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

const HELP = `
book — EPUB to interactive visual summary CLI

Usage:
  node book.js ingest <path.epub>   Parse + RAG index + AI analysis → library
  node book.js list                 Show all books in library
  node book.js explain <title>      Re-render HTML from cache (no live model calls)
  node book.js search <query>       Full-text TF-IDF search across all books
  node book.js info <title>         Show book metadata and cache status

Examples:
  node book.js ingest "/path/to/your-book.epub"
  node book.js list
  node book.js explain "An Inquiry into the Nature and Causes of the Wealth of Nations"
  node book.js search "division of labour"
  node book.js info "An Inquiry into the Nature and Causes of the Wealth of Nations"

Environment:
  AI_PROVIDER=claude-cli | anthropic | openai | openai-compatible
  AI_MODEL=<model-name>
  ANTHROPIC_API_KEY=<key>        required for anthropic
  OPENAI_API_KEY=<key>           required for openai/openai-compatible
  OPENAI_BASE_URL=<url>          optional for openai-compatible

Library location: ${LIBRARY_DIR}
`;

const [,, cmd, ...rest] = process.argv;

if (!cmd || cmd === '--help' || cmd === '-h') { console.log(HELP); process.exit(0); }

(async () => {
  try {
    switch (cmd) {
      case 'ingest':
        if (!rest[0]) { console.error('Usage: node book.js ingest <path.epub>'); process.exit(1); }
        await cmdIngest(rest[0]);
        break;
      case 'list':
        cmdList();
        break;
      case 'explain':
        if (!rest[0]) { console.error('Usage: node book.js explain <title>'); process.exit(1); }
        await cmdExplain(rest.join(' '));
        break;
      case 'search':
        if (!rest[0]) { console.error('Usage: node book.js search <query>'); process.exit(1); }
        cmdSearch(rest.join(' '));
        break;
      case 'info':
        if (!rest[0]) { console.error('Usage: node book.js info <title>'); process.exit(1); }
        cmdInfo(rest.join(' '));
        break;
      default:
        console.error(`Unknown command: ${cmd}\n${HELP}`);
        process.exit(1);
    }
  } catch (e) {
    console.error(`\nError: ${e.message}`);
    if (process.env.DEBUG) console.error(e.stack);
    process.exit(1);
  }
})();
