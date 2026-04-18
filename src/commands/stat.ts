/**
 * `stat` command — show repository information and indexing status.
 *
 * Endpoint: GET https://zread.ai/api/v1/repo/github/{owner}/{name}
 *
 * NOTE: The original Python tool had a critical bug here.
 * In the Python source, a wrapper function `get_repo_info()` called an
 * inner function that happened to share the exact same name. The wrapper
 * tried to pass a `lang=` keyword argument that the inner function did not
 * accept, causing: TypeError: get_repo_info() got an unexpected keyword argument 'lang'
 *
 * This TypeScript rewrite avoids the naming collision entirely.
 */

import { fetchRepoInfo, parseRepoUrl } from "../api.js";
import { resolveLang, formatRepoInfo, formatPlainRepoInfo, withSpinner } from "../utils.js";

export interface StatOptions {
  lang?: string;
  json?: boolean;
  plain?: boolean;
}

export async function statCommand(repoOrUrl: string, options: StatOptions = {}): Promise<void> {
  const lang = resolveLang(options.lang);

  const parsed = parseRepoUrl(repoOrUrl);
  const data = await withSpinner(
    `Fetching info for ${parsed.repoPath}...`,
    () => fetchRepoInfo(parsed.owner, parsed.repo)
  );

  if (!data) {
    console.error(`❌ Failed to fetch repository info for ${parsed.repoPath}`);
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (options.plain) {
    console.log(formatPlainRepoInfo(data));
    return;
  }

  console.log(formatRepoInfo(data));
}
