// render.js — backwards-compatible re-export facade
// Functionality has been split into:
//   lib/svg.js      — SVG generation helpers
//   lib/html.js     — HTML assembly and D3.js knowledge graph
//   lib/markdown.js — Markdown rendering

export {
  generateChapterSvg,
  fallbackSvg,
  wrapLines,
  renderTextLines,
  truncate,
  coveragePalette,
  coverageBadge,
  prepareChapterSvgs,
} from './svg.js';

export { renderHtml, assembleHtml } from './html.js';

export { buildMarkdown } from './markdown.js';
