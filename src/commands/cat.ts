/**
 * `cat` command — read a documentation page as Markdown.
 *
 * How it works:
 * 1. Fetches repo info via GET /api/v1/repo/github/{owner}/{name} to get wiki_id
 * 2. Fetches page content via GET /api/v1/wiki/{wikiId}/page/{slug}
 * 3. Returns data.content as Markdown
 */

import { fetchMarkdownPage, parseRepoUrl } from "../api.js";
import { resolveLang, withSpinner } from "../utils.js";

export interface CatOptions {
  lang?: string;
}

export async function catCommand(
  repoOrUrl: string,
  slugOrPath: string,
  options: CatOptions = {}
): Promise<void> {
  const lang = resolveLang(options.lang);
  const parsed = parseRepoUrl(repoOrUrl);

  const md = await withSpinner(
    `Fetching page ${slugOrPath}...`,
    () => fetchMarkdownPage(parsed.owner, parsed.repo, slugOrPath, lang)
  );

  console.log(md);
}
