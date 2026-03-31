// Provider-agnostic analysis layer for chapter summaries and synthesis
import { generateText, parseJsonResponse, getAiConfig, describeAiConfig } from './ai.js';
import { retrieveForChapter, query } from './rag.js';
import { logger } from './logger.js';

const CONCURRENCY = parseInt(process.env.AI_CONCURRENCY || '5', 10);
const MAX_CHAPTER_CHARS = 20000;  // ~5000 words, keeps prompt within model context limits
const MAX_SYNTHESIS_CHARS = 80000; // fits all chapter summaries for typical books

const CHAPTER_SYSTEM = `You are an expert book analyst. Analyze the provided chapter and return a JSON object with EXACTLY these fields:
- "summary": string (3-5 paragraphs explaining the chapter's argument from first principles for a reader with zero background)
- "coverage_type": one of "core_argument" | "illustrative" | "background" | "reference"
- "concepts": array of 3-5 objects, each with: "id" (snake_case string), "label" (short display name), "description" (one sentence)
- "concept_edges": array of objects with: "from" (concept id), "to" (concept id), "label" (e.g. "requires", "causes", "contradicts", "builds on", "exemplifies")
- "key_quotes": array of 2-3 verbatim sentences from the chapter that best capture its argument

Return ONLY valid JSON. No markdown, no explanation, no code fences.`;

function synthesisSystem(chapterCount) {
  const targetNodes = Math.min(Math.max(Math.round(chapterCount * 1.5), 15), 60);
  const targetEdges = Math.round(targetNodes * 2.5);
  return `You are an expert book analyst. You have chapter-by-chapter summaries and cross-chapter context for a book. Return a JSON object with EXACTLY these fields:
- "central_claim": string (one tight paragraph — the author's core thesis)
- "book_summary": string (5-7 paragraphs explaining the full argument from first principles for a reader with zero background)
- "nodes": array of objects with: "id" (snake_case), "label", "description", "chapters" (array of chapter ids where concept appears prominently)
- "edges": array of objects with: "from" (node id), "to" (node id), "label" (relationship type)

The nodes and edges form a cross-book knowledge graph. Aim for ${targetNodes} nodes and ${targetEdges} edges with meaningful labeled relationships. Prefer specific, distinct concepts over broad generalizations.
Return ONLY valid JSON. No markdown, no explanation, no code fences.`;
}

// Retries only on JSON parse failure (not API failure — retryWithBackoff in
// ai.js already handles that). Avoids up to 8x API calls from double-retry stacking.
async function generateJsonWithRetry({ system, prompt, maxTokens, config, label }) {
  const text = await generateText({ system, prompt, maxTokens, config });
  try {
    return parseJsonResponse(text);
  } catch {
    if (label) process.stdout.write(`${label} retry...\n`);
    const retryText = await generateText({ system, prompt, maxTokens, config });
    return parseJsonResponse(retryText);
  }
}

async function analyzeChapter(chapter, index, position, total, config) {
  process.stdout.write(`  [${position}/${total}] ${chapter.title}...`);

  const ragChunks = retrieveForChapter(index, chapter.title, 'main argument key concept', 5);
  const ragBlock = ragChunks.length
    ? '\n\n[RAG-retrieved key passages]\n' + ragChunks.map(c =>
        `[${c.chapter} | score:${c.score.toFixed(3)}]\n${c.text}`
      ).join('\n\n')
    : '';

  const prompt = `Chapter title: ${chapter.title}
${ragBlock}

[Chapter text excerpt]
${chapter.text.slice(0, MAX_CHAPTER_CHARS)}`;

  const endChapter = logger.stage(`chapter[${position}/${total}] "${chapter.title}"`);
  try {
    const result = await generateJsonWithRetry({
      system: CHAPTER_SYSTEM,
      prompt,
      maxTokens: 2048,
      config,
      label: '',
    });
    process.stdout.write(' done\n');
    endChapter(`concepts=${result.concepts?.length || 0}  quotes=${result.key_quotes?.length || 0}`);
    return result;
  } catch (error) {
    process.stdout.write(` failed: ${error.message}\n`);
    logger.error(`chapter[${position}/${total}] "${chapter.title}": ${error.message}`);
    endChapter('FAILED');
    return {
      summary: `[Analysis unavailable: ${error.message}]`,
      coverage_type: 'reference',
      concepts: [],
      concept_edges: [],
      key_quotes: [],
    };
  }
}

export async function analyzeAllChapters(chapters, index, options = {}) {
  const config = options.config || getAiConfig();
  process.stdout.write(`  Provider: ${describeAiConfig(config)}\n`);

  const analyses = new Array(chapters.length);
  for (let i = 0; i < chapters.length; i += CONCURRENCY) {
    const batch = chapters.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((ch, j) => analyzeChapter(ch, index, i + j + 1, chapters.length, config))
    );
    results.forEach((r, j) => { analyses[i + j] = r; });
  }
  return analyses;
}

export async function synthesize(chapters, chapterAnalyses, index, options = {}) {
  const config = options.config || getAiConfig();
  process.stdout.write('\n  Running synthesis...');

  const crossQueries = [
    'central argument thesis main claim',
    'key concepts frameworks principles',
    'practical applications rules strategies',
    'evidence examples case studies',
  ];
  const ragSnippets = crossQueries.flatMap(q =>
    query(index, q, 3).map(r => `[${r.chapter}] ${r.text.slice(0, 300)}`)
  );
  const ragBlock = ragSnippets.length
    ? '\n\n[RAG cross-chapter context]\n' + ragSnippets.join('\n\n')
    : '';

  const chaptersBlock = chapters.map((ch, i) => {
    const r = chapterAnalyses[i] || {};
    const concepts = (r.concepts || []).map(c => `  - ${c.label}: ${c.description}`).join('\n');
    return `## ${ch.title} [${r.coverage_type || 'reference'}]\n${r.summary || ''}\n\nConcepts:\n${concepts}`;
  }).join('\n\n---\n\n');

  const prompt = `${(chaptersBlock + ragBlock).slice(0, MAX_SYNTHESIS_CHARS)}`;

  try {
    const result = await generateJsonWithRetry({
      system: synthesisSystem(chapters.length),
      prompt,
      maxTokens: 8192,
      config,
      label: '',
    });
    process.stdout.write(' done\n');
    return result;
  } catch (error) {
    process.stdout.write(` failed: ${error.message}\n`);
    logger.error(`synthesis: ${error.message}`);
    return { central_claim: '[Unavailable]', book_summary: '[Unavailable]', nodes: [], edges: [] };
  }
}
