/**
 * ZRead API Client
 *
 * Communicates with zread.ai to fetch repository documentation,
 * metadata, and outlines. All endpoints return JSON in the shape:
 *   { code: number, data: any, msg?: string }
 * code === 0 means success.
 */

// ==============================================================================
// Constants
// ==============================================================================

export const BASE_URL = "https://zread.ai";
export const USER_AGENT = "Mozilla/5.0 (compatible; zread-ts/1.0.0; +https://github.com/efjdkev/zread)";

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
};

const REQUEST_TIMEOUT_MS = 30_000;

// ==============================================================================
// Types
// ==============================================================================

export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  msg?: string;
}

export interface RepoInfo {
  repo_id: string;
  owner: string;
  name: string;
  description: string;
  stars: number;
  language: string;
  topics: string[];
  license?: { name: string };
  status: "active" | "inactive" | "progress" | string;
  wiki_id: string;
  updated_at: number;
}

export interface RepoSearchResult {
  url?: string;
  owner?: string;
  name?: string;
  description?: string;
  stars?: number;
  language?: string;
  topics?: string[];
}

export interface OutlinePage {
  page_id: string;
  slug: string;
  title: string;
  topic: string;
  group: string;
  section: string;
  order?: number;
}

export interface TrendingGroup {
  title: string;
  time_span: string;
  repos: RepoSearchResult[];
}

// ==============================================================================
// HTTP Helpers
// ==============================================================================

async function httpGet<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...DEFAULT_HEADERS,
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = (await response.json()) as ApiResponse<T>;
    return json;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  }
}

// ==============================================================================
// Public API Methods
// ==============================================================================

/**
 * Search GitHub repositories on zread.ai.
 * Endpoint: GET /api/v1/repo?q={query}
 */
export async function searchRepos(query: string, lang = "zh"): Promise<RepoSearchResult[]> {
  const url = `${BASE_URL}/api/v1/repo?q=${encodeURIComponent(query)}`;
  const res = await httpGet<RepoSearchResult[]>(url, {
    headers: { "x-locale": lang },
  });
  if (res.code !== 0) {
    throw new Error(res.msg ?? "Search failed");
  }
  return res.data ?? [];
}

/**
 * Get repository info and status.
 * Endpoint: GET /api/v1/repo/github/{owner}/{name}
 *
 * NOTE: The original Python tool had a bug here where the wrapper function
 * get_repo_info() recursively called an inner function with the same name
 * but passed a non-existent `lang` argument, causing TypeError.
 * This TS implementation avoids that naming collision entirely.
 */
export async function fetchRepoInfo(
  owner: string,
  name: string
): Promise<RepoInfo | null> {
  const url = `${BASE_URL}/api/v1/repo/github/${owner}/${name}`;
  try {
    const res = await httpGet<RepoInfo>(url);
    if (res.code !== 0) {
      return null;
    }
    return res.data;
  } catch {
    return null;
  }
}

/**
 * Get trending repositories (weekly).
 * Endpoint: GET /api/v1/public/repo/trending
 */
export async function getTrendingRepos(lang = "zh"): Promise<TrendingGroup[]> {
  const url = `${BASE_URL}/api/v1/public/repo/trending`;
  const res = await httpGet<TrendingGroup[]>(url, {
    headers: { "X-Locale": lang },
  });
  if (res.code !== 0) {
    throw new Error(res.msg ?? "Failed to fetch trending");
  }
  return res.data ?? [];
}

/**
 * Get recommended repositories.
 * Endpoint: GET /api/v1/repo/recommend?topic={topic}
 */
export async function getRecommendations(
  topic?: string,
  lang = "zh"
): Promise<{ topics?: string[]; repos?: RepoSearchResult[] } | null> {
  const url = new URL(`${BASE_URL}/api/v1/repo/recommend`);
  if (topic) url.searchParams.set("topic", topic);

  const res = await httpGet<{ topics?: string[]; repos?: RepoSearchResult[] }>(url.toString(), {
    headers: { "X-Locale": lang },
  });
  if (res.code !== 0) {
    throw new Error(res.msg ?? "Recommendations failed");
  }
  return res.data;
}

/**
 * Submit a GitHub repository for indexing.
 * Endpoint: POST /api/v1/public/repo/submit
 */
export async function submitRepo(
  nameOrPath: string,
  email?: string
): Promise<unknown | null> {
  const url = `${BASE_URL}/api/v1/public/repo/submit`;
  const body = {
    name_or_path: nameOrPath,
    notification_email: email ?? undefined,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const res = (await response.json()) as ApiResponse<unknown>;
    if (res.code !== 0) return null;
    return res.data;
  } catch {
    return null;
  }
}

/**
 * Refresh repository index.
 * Endpoint: POST /api/v1/repo/{repo_id}/refresh
 */
export async function refreshRepo(repoId: string): Promise<boolean> {
  const url = `${BASE_URL}/api/v1/repo/${repoId}/refresh`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: DEFAULT_HEADERS,
    });
    return response.status < 300;
  } catch {
    return false;
  }
}

/**
 * Fetch file contents from a repository.
 * Endpoint: POST /api/v1/repo/{repo_id}/files
 */
export async function fetchRepoFiles(
  repoId: string,
  files: { path: string; start_line?: number; end_line?: number }[]
): Promise<unknown[] | null> {
  const url = `${BASE_URL}/api/v1/repo/${repoId}/files`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files }),
    });
    if (!response.ok) return null;
    const res = (await response.json()) as ApiResponse<unknown[]>;
    if (res.code !== 0) return null;
    return res.data;
  } catch {
    return null;
  }
}

/**
 * Fetch the documentation outline (page list) for a repository.
 *
 * This does NOT use a JSON API endpoint. Instead, it fetches the HTML page
 * and extracts an embedded JSON payload that contains wiki metadata.
 *
 * Endpoint: GET https://zread.ai/{owner}/{repo}  (returns HTML)
 */
export async function fetchRepoOutline(
  owner: string,
  repo: string,
  lang = "zh"
): Promise<OutlinePage[]> {
  const url = `${BASE_URL}/${owner}/${repo}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        ...DEFAULT_HEADERS,
        "RSC": "1",
        "X-Locale": lang,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    return parseOutlineFromRsc(text);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Fetch a single documentation page as Markdown.
 *
 * This uses a special binary encoding in the response body.
 * The response contains an embedded length header followed by the
 * actual markdown content in UTF-8.
 *
 * Endpoint: GET https://zread.ai/{owner}/{repo}/{slug}
 * Headers: { RSC: "1" }
 */
export async function fetchMarkdownPage(
  owner: string,
  repo: string,
  slug: string,
  lang = "zh"
): Promise<string> {
  const url = `${BASE_URL}/${owner}/${repo}/${slug}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        ...DEFAULT_HEADERS,
        "RSC": "1",
        "X-Locale": lang,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return parseMarkdownFromBuffer(buffer);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Search within a repository's wiki.
 * Endpoint: GET /api/v1/wiki/{wiki_id}/search?q={query}
 */
export async function searchWiki(
  wikiId: string,
  query: string,
  lang = "zh"
): Promise<unknown[] | null> {
  const url = new URL(`${BASE_URL}/api/v1/wiki/${wikiId}/search`);
  url.searchParams.set("q", query);

  try {
    const res = await httpGet<unknown[]>(url.toString(), {
      headers: { "x-locale": lang },
    });
    if (res.code !== 0) return null;
    return res.data ?? [];
  } catch {
    return null;
  }
}

// ==============================================================================
// Response Parsers
// ==============================================================================

/**
 * Parse the wiki outline from the RSC (React Server Component) response.
 *
 * When requesting with the `RSC: 1` header, zread.ai returns a Next.js
 * RSC payload instead of HTML. The wiki data is embedded as a plain JSON
 * object `{"wiki":{"info":{...},"pages":[...]}}` within this payload.
 *
 * We locate the JSON object by finding `{"wiki":` and then use a
 * brace-matching algorithm to extract the complete object.
 */
function parseOutlineFromRsc(text: string): OutlinePage[] {
  // Find the start of the wiki JSON object
  const wikiStart = text.indexOf('{"wiki"');
  if (wikiStart === -1) {
    throw new Error("Could not find wiki data in RSC response");
  }

  // Brace-matching to find the end of the JSON object
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = wikiStart;

  for (let i = wikiStart; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"' && !escaped) {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
  }

  const jsonStr = text.slice(wikiStart, end);
  const wikiObj = JSON.parse(jsonStr) as Record<string, unknown>;
  const wiki = wikiObj.wiki as Record<string, unknown> | undefined;

  if (!wiki || !Array.isArray(wiki.pages)) {
    throw new Error("Wiki pages not found in parsed data");
  }

  const pages: OutlinePage[] = [];
  for (const page of wiki.pages) {
    if (!page || typeof page !== "object") continue;
    const p = page as Record<string, unknown>;

    const section = String(p.section ?? "");
    const group = String(p.group ?? "");
    const topic = String(p.topic ?? "");
    const parts = [section, group, topic].filter((x) => x);
    const title = parts.join("/");

    pages.push({
      page_id: String(p.page_id ?? ""),
      slug: String(p.slug ?? ""),
      title,
      topic,
      group,
      section,
      order: typeof p.order === "number" ? p.order : undefined,
    });
  }

  return pages;
}

/**
 * Parse the Markdown content from the binary response buffer.
 *
 * The response uses a custom binary framing format:
 * 1. The last occurrence of `,---` marks the end of the length header
 * 2. Before that marker is a line like `81:T42bf,`
 * 3. The regex `^([0-9a-f]+):T([0-9a-f]+),` captures:
 *    - group(1): unknown hex id
 *    - group(2): content byte length in hex
 * 4. After the comma, the next `byte_length` bytes are the UTF-8 markdown
 */
function parseMarkdownFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const marker = Buffer.from(",---");

  // Find the last occurrence of ",---"
  let endPos = -1;
  for (let i = bytes.length - marker.length; i >= 0; i--) {
    if (
      bytes[i] === marker[0] &&
      bytes[i + 1] === marker[1] &&
      bytes[i + 2] === marker[2] &&
      bytes[i + 3] === marker[3]
    ) {
      endPos = i;
      break;
    }
  }

  if (endPos === -1) {
    throw new Error("Invalid response format: marker not found");
  }

  // Find the start of the line containing the marker
  let lineStart = endPos;
  while (lineStart > 0 && bytes[lineStart - 1] !== 0x0a) {
    lineStart--;
  }

  // Extract the header line (e.g. "81:T42bf,")
  const headerBytes = bytes.slice(lineStart, endPos + 1); // include the comma
  const headerLine = Buffer.from(headerBytes).toString("latin1");

  const headPattern = /^([0-9a-f]+):T([0-9a-f]+),/;
  const match = headPattern.exec(headerLine);
  if (!match) {
    throw new Error(`Invalid header format: ${headerLine.slice(0, 50)}`);
  }

  const byteLength = parseInt(match[2], 16);
  if (isNaN(byteLength) || byteLength <= 0) {
    throw new Error(`Invalid byte length: ${match[2]}`);
  }

  // The content starts after the comma
  const headerEnd = lineStart + match[0].length;
  const contentBytes = bytes.slice(headerEnd, headerEnd + byteLength);

  try {
    return Buffer.from(contentBytes).toString("utf-8");
  } catch {
    throw new Error("Failed to decode content as UTF-8");
  }
}

// ==============================================================================
// URL Parser Utility
// ==============================================================================

export interface ParsedRepoUrl {
  owner: string;
  repo: string;
  repoPath: string;
  filePath?: string;
  zreadUrl: string;
}

/**
 * Parse various repository URL formats into a normalized structure.
 *
 * Supported formats:
 *   - owner/repo
 *   - https://github.com/owner/repo
 *   - https://zread.ai/owner/repo
 *   - https://github.com/owner/repo/blob/branch/path
 */
export function parseRepoUrl(urlOrPath: string): ParsedRepoUrl {
  let url = urlOrPath.trim();

  // Strip GitHub blob URLs to get the raw owner/repo/path
  const blobMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/blob\/[^\/]+\/(.+)$/);
  if (blobMatch) {
    return {
      owner: blobMatch[1],
      repo: blobMatch[2],
      repoPath: `${blobMatch[1]}/${blobMatch[2]}`,
      filePath: blobMatch[3],
      zreadUrl: `${BASE_URL}/${blobMatch[1]}/${blobMatch[2]}`,
    };
  }

  // Strip protocol prefixes
  if (url.startsWith("https://")) url = url.slice(8);
  if (url.startsWith("http://")) url = url.slice(7);

  // Handle zread.ai URLs
  if (url.startsWith("zread.ai/")) {
    url = url.slice(9);
  }

  // Handle github.com URLs
  if (url.startsWith("github.com/")) {
    url = url.slice(11);
  }

  // Extract line numbers from URL fragment
  const lineMatch = url.match(/#L(\d+)(?:-L(\d+))?$/);
  if (lineMatch) {
    url = url.slice(0, lineMatch.index);
  }

  // Parse owner/repo/path format
  const parts = url.split("/");
  if (parts.length >= 2) {
    const owner = parts[0];
    const repo = parts[1];
    const result: ParsedRepoUrl = {
      owner,
      repo,
      repoPath: `${owner}/${repo}`,
      zreadUrl: `${BASE_URL}/${owner}/${repo}`,
    };
    if (parts.length > 2) {
      result.filePath = parts.slice(2).join("/");
    }
    return result;
  }

  throw new Error(`Cannot parse repository path: ${urlOrPath}. Use format: owner/repo`);
}
