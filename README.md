# zread-docs-cli

Browse and export [zread.ai](https://zread.ai) repository documentation from the command line.

**zread.ai** is a service that analyzes open-source repositories and generates structured documentation (wiki pages) from the codebase. This CLI tool lets you search repositories, list documentation pages, read them as Markdown, and export entire wikis locally — no authentication required for read operations.

---

## Installation

### From npm (recommended)

```bash
npm install -g zread-docs-cli
```

### From source

```bash
git clone https://github.com/yamsfeer/zread-docs-cli.git
cd zread-docs-cli
npm install
npm run build
npm link
```

**Requirements:** Node.js >= 18 (uses the native `fetch` API)

---

## Quick Start

```bash
# Search for repositories
zread-docs find react --limit 5

# Check if a repository is indexed
zread-docs stat facebook/react

# List all documentation pages
zread-docs ls facebook/react

# Read a specific page
zread-docs cat facebook/react 1-overview

# Export the entire wiki locally
zread-docs cp facebook/react ./docs
```

---

## Commands

### `find <query>`

Search GitHub repositories indexed on zread.ai.

```bash
zread-docs find react --limit 10
zread-docs find kubernetes -l en
```

| Option | Description |
|--------|-------------|
| `--limit <n>` | Maximum results to show (default: 20) |
| `-l, --lang <lang>` | Language: `zh` or `en` (default: auto-detect or `zh`) |

---

### `stat <repo>`

Show repository information and indexing status.

```bash
zread-docs stat facebook/react
zread-docs stat torvalds/linux -j
```

| Option | Description |
|--------|-------------|
| `-l, --lang <lang>` | Language: `zh` or `en` |
| `-j, --json` | Output raw JSON |
| `-p, --plain` | Output plain text without colors |

---

### `ls <repo>`

Show the documentation outline (table of contents).

```bash
zread-docs ls facebook/react
zread-docs ls golang/go -l en
```

| Option | Description |
|--------|-------------|
| `-l, --lang <lang>` | Language: `zh` or `en` |

**How it works:** This command fetches a React Server Component (RSC) payload from zread.ai and extracts the embedded wiki page list.

---

### `cat <repo> <slug>`

Read a single documentation page as Markdown.

```bash
zread-docs cat facebook/react 1-overview
zread-docs cat golang/go 1-overview -l en
```

| Option | Description |
|--------|-------------|
| `-l, --lang <lang>` | Language: `zh` or `en` |

**How it works:** The response uses a custom binary framing format. The tool parses the embedded length header to extract the UTF-8 Markdown content.

---

### `cp <repo> [outputDir]`

Export **all** documentation pages to local files.

```bash
zread-docs cp facebook/react
zread-docs cp golang/go ./docs -c 20
```

| Option | Description |
|--------|-------------|
| `-l, --lang <lang>` | Language: `zh` or `en` |
| `-c, --concurrency <n>` | Parallel download limit (default: 10) |
| `outputDir` | Output directory (default: current directory) |

**Output files:**
- `{slug}.md` — One Markdown file per page
- `llms.txt` — Index with local relative links
- `llms-full.txt` — Full concatenated content with remote links to zread.ai

---

## API Reference

This tool communicates with `https://zread.ai`. All JSON responses follow this shape:

```json
{ "code": 0, "data": "...", "msg": "..." }
```

`code === 0` indicates success.

### Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/repo?q={query}` | GET | No | Search repositories |
| `/api/v1/repo/github/{owner}/{name}` | GET | No | Get repository info & status |
| `/api/v1/public/repo/trending` | GET | No | Weekly trending repositories |
| `/api/v1/repo/recommend?topic={topic}` | GET | No | Recommended repositories |
| `/api/v1/public/repo/submit` | POST | No | Submit a repo for indexing |
| `/api/v1/repo/{repo_id}/refresh` | POST | Yes | Request re-index |
| `/api/v1/repo/{repo_id}/files` | POST | Yes* | Fetch file contents |
| `/api/v1/wiki/{wiki_id}/search?q={query}` | GET | Yes* | Search inside wiki |
| `/{owner}/{repo}` | GET | No | RSC payload with wiki outline |
| `/{owner}/{repo}/{slug}` | GET | No | RSC payload with Markdown content |

\* Some endpoints work without a token but may have rate limits.

### Request Headers

| Header | Value | Used when |
|--------|-------|-----------|
| `User-Agent` | `Mozilla/5.0 (compatible; zread-docs-cli/1.0.0; ...)` | Always |
| `RSC` | `1` | `ls` and `cat` commands |
| `X-Locale` / `x-locale` | `zh` or `en` | Language preference |
| `Authorization` | `Bearer {token}` | Token-required endpoints |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ZREAD_LANG` | Default language (`zh` or `en`), lower priority than `--lang` |

---

## License

MIT
