/**
 * ZRead API Client
 *
 * Communicates with zread.ai to fetch repository documentation,
 * metadata, and outlines. All endpoints return JSON in the shape:
 *   { code: number, data: any, msg?: string }
 * code === 0 means success.
 *
 * Wiki endpoints:
 *   GET /api/v1/wiki/:wikiId             → { info, pages[] }
 *   GET /api/v1/wiki/:wikiId/page/:slug  → { level, content }
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
 * Uses the official wiki API: GET /api/v1/wiki/:wikiId
 * Requires a wiki_id, obtained via fetchRepoInfo().
 */
export async function fetchRepoOutline(
  owner: string,
  repo: string,
  lang = "zh"
): Promise<{ pages: OutlinePage[]; wikiId: string }> {
  const repoInfo = await fetchRepoInfo(owner, repo);
  if (!repoInfo) {
    throw new Error(`Repository not found: ${owner}/${repo}`);
  }

  const url = `${BASE_URL}/api/v1/wiki/${repoInfo.wiki_id}`;
  const res = await httpGet<{ info: unknown; pages: Array<Record<string, unknown>> }>(url, {
    headers: { "x-locale": lang },
  });
  if (res.code !== 0) {
    throw new Error(res.msg ?? "Failed to fetch wiki outline");
  }

  const pages: OutlinePage[] = [];
  for (const page of res.data?.pages ?? []) {
    const section = String(page.section ?? "");
    const group = String(page.group ?? "");
    const topic = String(page.topic ?? "");
    const parts = [section, group, topic].filter((x) => x);
    const title = parts.join("/");

    pages.push({
      page_id: String(page.page_id ?? ""),
      slug: String(page.slug ?? ""),
      title,
      topic,
      group,
      section,
      order: typeof page.order === "number" ? page.order : undefined,
    });
  }

  return { pages, wikiId: repoInfo.wiki_id };
}

/**
 * Fetch a single documentation page as Markdown.
 *
 * Uses the official wiki API: GET /api/v1/wiki/:wikiId/page/:slug
 * Returns the page content as a Markdown string.
 */
export async function fetchMarkdownPage(
  owner: string,
  repo: string,
  slug: string,
  lang = "zh"
): Promise<string> {
  const repoInfo = await fetchRepoInfo(owner, repo);
  if (!repoInfo) {
    throw new Error(`Repository not found: ${owner}/${repo}`);
  }

  return fetchMarkdownPageByWikiId(repoInfo.wiki_id, slug, lang);
}

/**
 * Fetch a documentation page by wiki ID (avoids redundant fetchRepoInfo calls).
 */
export async function fetchMarkdownPageByWikiId(
  wikiId: string,
  slug: string,
  lang = "zh"
): Promise<string> {
  const url = `${BASE_URL}/api/v1/wiki/${wikiId}/page/${slug}`;
  const res = await httpGet<{ level: string; content: string }>(url, {
    headers: { "x-locale": lang },
  });
  if (res.code !== 0) {
    throw new Error(res.msg ?? `Failed to fetch page: ${slug}`);
  }

  return res.data?.content ?? "";
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
