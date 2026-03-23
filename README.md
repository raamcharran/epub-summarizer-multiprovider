# EPUB Infographic Summarizer

> Turn any EPUB book into a rich, interactive visual summary — AI-generated chapter infographics, a clickable knowledge graph, and a full markdown export.

Built to run inside **Claude Code** with zero API costs (uses your Claude Max subscription). Also works with Anthropic API, OpenAI, or any OpenAI-compatible provider.

---

## What you get

For every book you ingest, the tool produces a single self-contained HTML file with:

- **Per-chapter SVG infographics** — AI-designed visual layouts (flowcharts, timelines, hub-and-spoke diagrams, etc.) tailored to each chapter's content
- **Interactive D3.js knowledge graph** — 20–28 nodes representing the book's key concepts, cross-linked to chapter sections
- **Central claim + book summary** — the author's core thesis extracted and explained
- **Key quotes** — verbatim sentences that best capture each chapter's argument
- **Markdown export** — download the full summary as `.md` with one click

---

## Quickest way to use it — Claude Code (no API key needed)

If you have **Claude Code** with a Claude Max subscription, this is the fastest path. No API key required — it uses your existing session.

```bash
# 1. Clone and install
git clone https://github.com/raamcharran/epub-summarizer-multiprovider
cd epub-summarizer-multiprovider
npm install

# 2. Run inside Claude Code
# Open this folder in Claude Code, then type:
/book "/path/to/your-book.epub"
```

Claude Code handles the rest. You'll be notified when the HTML is ready (usually 2–15 min depending on book length). All stages are cached — if interrupted, re-running resumes from where it left off.

---

## Using with an API key (outside Claude Code)

```bash
# 1. Clone and install
git clone https://github.com/raamcharran/epub-summarizer-multiprovider
cd epub-summarizer-multiprovider
npm install

# 2. Set your API key (pick one)
export ANTHROPIC_API_KEY=sk-ant-...
# or: export OPENAI_API_KEY=sk-...

# 3. Ingest a book
node book.js ingest "/path/to/your-book.epub"
```

Output is saved to `library/<book-slug>/output/summary.html`. Open it in any browser.

---

## Supported AI providers

| Provider | How to activate | Default model |
|---|---|---|
| **Claude Code** (recommended) | Use the `/book` skill inside Claude Code | session default |
| **Anthropic API** | `ANTHROPIC_API_KEY=sk-ant-...` | `claude-sonnet-4-6` |
| **OpenAI** | `OPENAI_API_KEY=sk-...` | `gpt-4o-mini` |
| **OpenAI-compatible** (Groq, Together, Ollama…) | `OPENAI_API_KEY=...` + `OPENAI_BASE_URL=https://...` | `gpt-4o-mini` |

Copy `.env.example` to `.env` and fill in your key. See [PROVIDERS.md](PROVIDERS.md) for full setup details.

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

## Requirements

- **Node.js 18+**
- One of: Claude Code (Claude Max), Anthropic API key, or OpenAI API key
- A DRM-free EPUB file

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
  rag.js        — Pure-JS TF-IDF search engine
  html.js      — HTML + SVG + Markdown renderer
  library.js   — Per-book disk storage and caching
```

---

## License

MIT
