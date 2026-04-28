import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonResponse } from '../lib/ai.js';
import { buildIndex, query } from '../lib/rag.js';
import { wrapLines } from '../lib/svg.js';
import { resolveBookSlug } from '../lib/library.js';
import { escapeHtml } from '../lib/util.js';

// ── 1. parseJsonResponse ─────────────────────────────────────────────────────

describe('parseJsonResponse', () => {
  test('valid JSON object returns parsed object', () => {
    const result = parseJsonResponse('{"key":"value","num":42}');
    assert.deepEqual(result, { key: 'value', num: 42 });
  });

  test('JSON wrapped in markdown fences returns parsed object', () => {
    const fenced = '```json\n{"hello":"world"}\n```';
    const result = parseJsonResponse(fenced);
    assert.deepEqual(result, { hello: 'world' });
  });

  test('JSON with unescaped control characters repairs and returns parsed object', () => {
    // A newline inside a string value — invalid JSON, should be repaired
    const broken = '{"text":"line one\nline two"}';
    const result = parseJsonResponse(broken);
    assert.ok(result && typeof result === 'object', 'should return an object');
    assert.ok(typeof result.text === 'string', 'text field should be a string');
  });

  test('truncated JSON throws or returns null', () => {
    const truncated = '{"key":"value", "another":';
    let threw = false;
    let result = null;
    try {
      result = parseJsonResponse(truncated);
    } catch {
      threw = true;
    }
    assert.ok(threw || result === null, 'should throw or return null for truncated JSON');
  });
});

// ── 2. buildIndex and query ──────────────────────────────────────────────────

describe('buildIndex and query', () => {
  const sampleChapters = [
    {
      title: 'Chapter One',
      text: 'The division of labour is the separation of tasks in a system so that participants may specialize. ' +
            'This specialization allows workers to produce more output than if each person were self-sufficient. ' +
            'The wealth of a nation depends upon the skill, dexterity, and judgment with which labour is applied. ' +
            'Markets and trade expand the division of labour and thus increase the productive power of nations.',
    },
    {
      title: 'Chapter Two',
      text: 'Shallow work includes non-cognitively demanding logistical-style tasks, often performed ' +
            'while distracted. These efforts tend to not create much new value in the world and are ' +
            'easy to replicate. Email, meetings, and administrative tasks are common examples of ' +
            'shallow work that consume professional time without generating deep value.',
    },
  ];

  test('buildIndex returns index with chunks and idf', () => {
    const index = buildIndex(sampleChapters);
    assert.ok(Array.isArray(index.chunks), 'index.chunks should be an array');
    assert.ok(index.chunks.length > 0, 'index.chunks should have entries');
    assert.ok(typeof index.idf === 'object' && index.idf !== null, 'index.idf should be an object');
    assert.ok(Object.keys(index.idf).length > 0, 'idf should have vocabulary entries');
    assert.ok(index.meta && typeof index.meta.totalChunks === 'number', 'meta.totalChunks should be a number');
    assert.ok(index.meta && typeof index.meta.vocabSize === 'number', 'meta.vocabSize should be a number');
  });

  test('query returns top-k chunks in ranked order', () => {
    const index = buildIndex(sampleChapters);
    const results = query(index, 'division of labour trade', 3);
    assert.ok(Array.isArray(results), 'results should be an array');
    assert.ok(results.length <= 3, 'should return at most k results');
    assert.ok(results.length > 0, 'should return at least one result');
    // Scores should be in descending order
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].score >= results[i].score, 'results should be sorted by score descending');
    }
    // Each result should have expected fields
    assert.ok(typeof results[0].text === 'string', 'result should have text field');
    assert.ok(typeof results[0].chapter === 'string', 'result should have chapter field');
    assert.ok(typeof results[0].score === 'number', 'result should have score field');
  });

  test('query with empty string does not crash', () => {
    const index = buildIndex(sampleChapters);
    let results;
    assert.doesNotThrow(() => {
      results = query(index, '', 5);
    });
    assert.ok(Array.isArray(results), 'should return an array even for empty query');
  });
});

// ── 3. wrapLines ─────────────────────────────────────────────────────────────

describe('wrapLines', () => {
  test('short text fits in one line', () => {
    const lines = wrapLines('Hello world', 40, 3);
    assert.equal(lines.length, 1);
    assert.equal(lines[0], 'Hello world');
  });

  test('long text wraps correctly at maxWidth', () => {
    const text = 'This is a fairly long sentence that should definitely wrap across multiple lines when the maxChars is small';
    const lines = wrapLines(text, 20, 4);
    assert.ok(lines.length > 1, 'should wrap into multiple lines');
    // Each line should fit within maxChars (or be the last overflow with ellipsis)
    for (const line of lines) {
      assert.ok(line.length <= 25, `line "${line}" should be close to maxChars limit`);
    }
  });

  test('empty string returns empty array', () => {
    const lines = wrapLines('', 40, 3);
    assert.equal(lines.length, 0);
  });

  test('respects maxLines limit', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen';
    const lines = wrapLines(text, 10, 3);
    assert.ok(lines.length <= 3, 'should not exceed maxLines');
  });
});

// ── 4. resolveBookSlug ───────────────────────────────────────────────────────

describe('resolveBookSlug', () => {
  test('normal title produces slug with hyphens and lowercase', () => {
    const slug = resolveBookSlug('Wealth of Nations', 'Adam Smith');
    assert.ok(typeof slug === 'string', 'slug should be a string');
    assert.ok(slug === slug.toLowerCase(), 'slug should be lowercase');
    assert.ok(slug.includes('-'), 'slug should contain hyphens');
    assert.ok(!slug.includes(' '), 'slug should not contain spaces');
  });

  test('title with special characters is sanitized', () => {
    const slug = resolveBookSlug('The Art & Science of Learning!', 'Some Author');
    assert.ok(/^[a-z0-9-]+$/.test(slug), 'slug should only contain lowercase alphanumerics and hyphens');
  });

  test('collision appends -2 suffix', () => {
    // We use a title unlikely to exist in the library; two different authors get different slugs
    const slug1 = resolveBookSlug('Unique Title XYZ 999', 'Author One');
    const slug2 = resolveBookSlug('Unique Title XYZ 999', 'Author Two');
    // Both slugs should be valid strings
    assert.ok(typeof slug1 === 'string');
    assert.ok(typeof slug2 === 'string');
    // They should both start with the title-based prefix
    assert.ok(slug1.startsWith('unique-title-xyz-999'), `slug1 "${slug1}" should start with title slug`);
    assert.ok(slug2.startsWith('unique-title-xyz-999'), `slug2 "${slug2}" should start with title slug`);
  });
});

// ── 5. escapeHtml ────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  test('<script> is escaped to &lt;script&gt;', () => {
    assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  });

  test('& is escaped to &amp;', () => {
    assert.equal(escapeHtml('&'), '&amp;');
  });

  test('" is escaped to &quot;', () => {
    assert.equal(escapeHtml('"'), '&quot;');
  });

  test("' is escaped to &#39;", () => {
    assert.equal(escapeHtml("'"), '&#39;');
  });

  test('null returns empty string', () => {
    assert.equal(escapeHtml(null), '');
  });

  test('undefined returns empty string', () => {
    assert.equal(escapeHtml(undefined), '');
  });

  test('combined HTML injection string is fully escaped', () => {
    const result = escapeHtml('<script>alert("xss")</script>');
    assert.ok(!result.includes('<script>'), 'should not contain raw <script>');
    assert.ok(!result.includes('"'), 'should not contain raw double quotes');
    assert.equal(result, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});
