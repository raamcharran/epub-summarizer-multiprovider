# TODOS

## SVG Consolidation
**What:** Move all SVG generation logic from `gen-svgs.mjs`, `smart-svgs.mjs`, and `render.js` into a single `lib/svg.js` module.
**Why:** Three files contain overlapping layout logic (5 layout types partially duplicated). Improving one doesn't benefit the others.
**Pros:** Single source of truth; enables isolated unit tests for SVG layout functions.
**Cons:** Moderate refactor; standalone scripts need wrapper entry points.
**Context:** The 5 layout types (fork, hub, cascade, grid, minimal) exist in `smart-svgs.mjs` but are also partially reimplemented in `render.js` `fallbackSvg()`. Adding a 6th layout requires touching both files today.
**Depends on:** render.js split (lib/svg.js + lib/html.js + lib/markdown.js) should happen first.

---

## Structured Progress Reporting
**What:** Replace procedural `console.log()` calls with a structured progress tracker showing current stage, chapter N/total, and elapsed time.
**Why:** For a 30-chapter book taking 25+ minutes, the current output is a wall of text with no indication of remaining time or stuck stages.
**Pros:** Better UX; easier to spot stuck API calls; useful in CI/background jobs.
**Cons:** ~50-line utility module addition.
**Context:** Pipeline has 5 well-defined stages (parse → rag → analyze → synthesize → render). A simple stage+count tracker would be sufficient.
**Depends on:** None.

---

## Non-English Stop Words (i18n RAG)
**What:** Add localized stop word lists to `lib/rag.js`; detect language from first chapter and load the matching list.
**Why:** Current TF-IDF uses English-only stop words. French/German/Spanish books produce poor RAG results because common words aren't filtered.
**Pros:** Unlocks non-English book support; ~100-line change.
**Cons:** Requires bundling locale word lists per language.
**Context:** Can be done lazily with simple heuristic language detection (most common 3-letter words) before building the index.
**Depends on:** None.
