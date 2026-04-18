/**
 * `cat` command — read a documentation page as Markdown.
 *
 * How it works:
 * 1. Sends GET to https://zread.ai/{owner}/{repo}/{slug}
 * 2. Adds header `RSC: 1` to request the React Server Component payload
 * 3. The response body uses a custom binary framing format:
 *    - Ends with a marker `,---`
 *    - Before the marker is a header like `81:T42bf,`
 *    - The hex number after `T` is the content byte length
 *    - The actual markdown follows the comma, in UTF-8
 * 4. We extract and decode the markdown content
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
