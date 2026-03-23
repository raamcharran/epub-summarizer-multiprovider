# EPUB Infographic Summarizer

> Turn any EPUB book into a rich, interactive visual summary — AI-generated chapter infographics, a clickable knowledge graph, and a full markdown export.

Works with **Claude Code** (no API key needed — uses your Claude Pro or Max subscription). Also supports Anthropic API, OpenAI, or any OpenAI-compatible provider.

---

## What you get

For every book you ingest, the tool produces a single self-contained HTML file with:

- **Per-chapter SVG infographics** — AI-designed visual layouts (flowcharts, timelines, hub-and-spoke diagrams, etc.) tailored to each chapter's content
- **Interactive D3.js knowledge graph** — 20–28 nodes representing the book's key concepts, cross-linked to chapter sections
- **Central claim + book summary** — the author's core thesis extracted and explained
- **Key quotes** — verbatim sentences that best capture each chapter's argument
- **Markdown export** — download the full summary as `.md` with one click

---

## Quickstart

### Prerequisites

- **Node.js 18+**
- **Claude Code** installed and logged in with a Claude Pro or Max account:
  ```bash
  npm install -g @anthropic-ai/claude-code
  claude  # log in on first run
  ```

### Setup (one time)

```bash
git clone https://github.com/raamcharran/epub-summarizer-multiprovider
cd epub-summarizer-multiprovider
npm install
```

### Run it

```bash
node book.js ingest "/path/to/your-book.epub"
```

That's it. The tool uses your active Claude Code session — no API key required. Output is saved to `library/<book-slug>/output/summary.html`. Open it in any browser.

Typical time: **2–5 min** for a short book, **10–20 min** for a long one. All stages are cached — if interrupted, re-running resumes from where it left off.

---

## Using with an API key instead

If you're not on Claude Code, set one of these before running:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
```

Then run the same command:

```bash
node book.js ingest "/path/to/your-book.epub"
```

See [PROVIDERS.md](PROVIDERS.md) for full setup details including OpenAI-compatible endpoints (Groq, Together, Ollama, etc.).

---

## All providers

| Provider | How to activate | Default model |
|---|---|---|
| **Claude Code** (recommended) | Logged-in Claude Code session (Pro or Max) | session default |
| **Anthropic API** | `ANTHROPIC_API_KEY=sk-ant-...` | `claude-sonnet-4-6` |
| **OpenAI** | `OPENAI_API_KEY=sk-...` | `gpt-4o-mini` |
| **OpenAI-compatible** (Groq, Together, Ollama…) | `OPENAI_API_KEY=...` + `OPENAI_BASE_URL=https://...` | `gpt-4o-mini` |

Optional overrides:

```bash
AI_MODEL=claude-opus-4-6    # use a specific model
AI_CONCURRENCY=5            # parallel AI calls (default: 3)
FORCE_REBUILD=1             # re-run all stages even if cached
```

---

## CLI reference

```
node book.js ingest <path.epub>   Parse + analyze + generate HTML
node book.js list                 Show all books in your library
node book.js explain <title>      Re-render HTML from cache (no AI calls, instant)
node book.js search <query>       Full-text search across all ingested books
node book.js info <title>         Show book metadata and cache status
```

---

## How it works

```
EPUB file
  → Parse chapters           (epub2, strips HTML tags, filters short sections)
  → Build RAG index          (pure-JS TF-IDF, no embedding API needed)
  → Analyze each chapter     (AI: summary, concepts, key quotes, concept graph)
  → Synthesize book-wide     (AI: 20–28 node knowledge graph + edges)
  → Generate infographics    (AI: SVG layouts — 8 design types)
  → Render HTML              (D3.js force graph, scroll animations, dark theme)
```

Each stage is independently cached to disk. Re-running skips completed stages automatically.

---

## Known limitations

- **DRM-protected EPUBs will not work.** You need a DRM-free copy.
- **Image-heavy EPUBs** (comics, fixed-layout textbooks) may parse poorly — the tool extracts prose text, not images.
- **Very large books (60+ chapters)** will take longer and make more AI calls. The cache means you can stop and resume at any time.
- **SVG quality varies by model** — Claude Sonnet and GPT-4o produce the best results. Smaller models may fall back to simpler layouts.

---

## Project structure

```
book.js        — CLI entry point
lib/
  ai.js        — Multi-provider AI abstraction
  analyze.js   — Chapter analysis + book synthesis prompts
  rag.js       — Pure-JS TF-IDF search engine
  html.js      — HTML + SVG + Markdown renderer
  library.js   — Per-book disk storage and caching
```

---

## Sample books to try

Two public domain books from [Project Gutenberg](https://www.gutenberg.org/) were used during development and are great for a first test run:

- **The Wealth of Nations** — Adam Smith · [Gutenberg](https://www.gutenberg.org/ebooks/3300) · [View summary](https://htmlpreview.github.io/?https://github.com/raamcharran/epub-summarizer-multiprovider/blob/master/examples/wealth-of-nations/summary.html)
- **Random Reminiscences of Men and Events** — John D. Rockefeller · [Gutenberg](https://www.gutenberg.org/ebooks/17090) · [View summary](https://htmlpreview.github.io/?https://github.com/raamcharran/epub-summarizer-multiprovider/blob/master/examples/rockefeller-reminiscences/summary.html)

Both are DRM-free and available as EPUB directly from Project Gutenberg.

---

## License

MIT — see [LICENSE](LICENSE) for details.
