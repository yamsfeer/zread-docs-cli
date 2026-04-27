/**
 * `ls` command — show the documentation outline (table of contents).
 *
 * How it works:
 * 1. Fetches repo info via GET /api/v1/repo/github/{owner}/{name} to get wiki_id
 * 2. Fetches wiki outline via GET /api/v1/wiki/{wikiId}
 * 3. Parses the pages array into a tree structure
 */

import { fetchRepoOutline, parseRepoUrl } from "../api.js";
import { resolveLang, withSpinner } from "../utils.js";
import chalk from "chalk";

export interface LsOptions {
  lang?: string;
}

export async function lsCommand(repoOrUrl: string, options: LsOptions = {}): Promise<void> {
  const lang = resolveLang(options.lang);
  const parsed = parseRepoUrl(repoOrUrl);

  const { pages } = await withSpinner(
    `Fetching outline for ${parsed.repoPath}...`,
    () => fetchRepoOutline(parsed.owner, parsed.repo, lang)
  );

  if (!pages || pages.length === 0) {
    console.log("No documentation pages found.");
    return;
  }

  // Group by section -> group
  const tree = new Map<string, Map<string, Array<{ slug: string; title: string }>>>();

  for (const page of pages) {
    const section = page.section || "(root)";
    const group = page.group || "";

    if (!tree.has(section)) {
      tree.set(section, new Map());
    }
    const sectionMap = tree.get(section)!;

    if (!sectionMap.has(group)) {
      sectionMap.set(group, []);
    }
    sectionMap.get(group)!.push({ slug: page.slug, title: page.title });
  }

  // Print indented list
  console.log(chalk.bold(`${parsed.repoPath}`));

  for (const [section, groups] of tree) {
    console.log(`  ${chalk.cyan(section)}`);

    for (const [group, items] of groups) {
      if (group) {
        console.log(`    ${group}`);
        for (const item of items) {
          console.log(`      🔗 ${item.title}`);
        }
      } else {
        for (const item of items) {
          console.log(`    🔗 ${item.title}`);
        }
      }
    }
  }
}
