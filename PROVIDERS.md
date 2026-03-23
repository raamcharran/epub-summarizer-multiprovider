# Provider Setup

This copy of the project can route model calls through:

- `claude-cli`
- `anthropic`
- `openai`
- `openai-compatible`

## Environment variables

```powershell
$env:AI_PROVIDER='claude-cli'
$env:AI_MODEL='gpt-4o-mini'          # optional except on claude-cli
$env:ANTHROPIC_API_KEY='...'
$env:OPENAI_API_KEY='...'
$env:OPENAI_BASE_URL='https://api.openai.com/v1'
```

## Examples

Claude CLI session:

```powershell
$env:AI_PROVIDER='claude-cli'
node .\book.js ingest "C:\path\to\book.epub"
```

Anthropic API:

```powershell
$env:AI_PROVIDER='anthropic'
$env:AI_MODEL='claude-3-5-sonnet-latest'
$env:ANTHROPIC_API_KEY='YOUR_KEY'
node .\book.js ingest "C:\path\to\book.epub"
```

OpenAI API:

```powershell
$env:AI_PROVIDER='openai'
$env:AI_MODEL='gpt-4o-mini'
$env:OPENAI_API_KEY='YOUR_KEY'
node .\book.js ingest "C:\path\to\book.epub"
```

OpenAI-compatible endpoint:

```powershell
$env:AI_PROVIDER='openai-compatible'
$env:AI_MODEL='your-model-name'
$env:OPENAI_API_KEY='YOUR_KEY'
$env:OPENAI_BASE_URL='https://your-endpoint/v1'
node .\book.js ingest "C:\path\to\book.epub"
```

## Notes

- `explain` does not make live model calls; it uses cached or fallback infographics.
- `ingest` is the command that performs model analysis and synthesis.
- Different providers will not behave identically, but the app-level workflow is now shared.
