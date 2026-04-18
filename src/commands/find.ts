/**
 * `find` command — search GitHub repositories on zread.ai.
 *
 * Endpoint: GET https://zread.ai/api/v1/repo?q={query}
 */

import { searchRepos } from "../api.js";
import { resolveLang, formatRepoList, withSpinner } from "../utils.js";

export interface FindOptions {
  limit?: number;
  lang?: string;
}

export async function findCommand(query: string, options: FindOptions = {}): Promise<void> {
  const lang = resolveLang(options.lang);
  const limit = options.limit ?? 20;

  const repos = await withSpinner(`Searching for "${query}"...`, () => searchRepos(query, lang));

  const trimmed = repos.slice(0, limit);

  if (trimmed.length === 0) {
    console.log("No repositories found.");
    return;
  }

  console.log(formatRepoList(trimmed));
}
