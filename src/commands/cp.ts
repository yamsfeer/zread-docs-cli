/**
 * `cp` command — export all documentation pages to local files.
 *
 * Downloads every page's Markdown content concurrently and generates:
 *   - {slug}.md          — One file per documentation page
 *   - llms.txt           — Index with local relative links
 *   - llms-full.txt      — Full concatenated content with remote links
 *
 * How it works:
 * 1. Fetches the outline via fetchRepoOutline()
 * 2. Concurrently downloads each page via fetchMarkdownPage()
 * 3. Writes each page to {slug}.md
 * 4. Generates llms.txt and llms-full.txt
 *
 * Concurrency defaults to 10 parallel requests.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fetchRepoOutline, fetchMarkdownPageByWikiId, parseRepoUrl, type OutlinePage } from "../api.js";
import { resolveLang, withSpinner } from "../utils.js";

export interface CpOptions {
  lang?: string;
  concurrency?: number;
  outputDir?: string;
}

interface PageResult {
  page: OutlinePage;
  content: string;
  success: boolean;
  error?: string;
}

export async function cpCommand(repoOrUrl: string, options: CpOptions = {}): Promise<void> {
  const lang = resolveLang(options.lang);
  const concurrency = options.concurrency ?? 10;
  const outputDir = options.outputDir ?? process.cwd();

  const parsed = parseRepoUrl(repoOrUrl);
  const repoDirName = `${parsed.owner}-${parsed.repo}`;
  const repoDir = path.resolve(outputDir, repoDirName);

  console.log(`📦 Exporting: ${parsed.repoPath}`);
  console.log(`📁 Output directory: ${repoDir}`);
  console.log(`🌐 Language: ${lang}`);
  console.log(`⚡ Concurrency: ${concurrency}`);
  console.log();

  // Create output directory
  await fs.mkdir(repoDir, { recursive: true });

  // Fetch outline
  const { pages, wikiId } = await withSpinner(
    `Fetching outline for ${parsed.repoPath}...`,
    () => fetchRepoOutline(parsed.owner, parsed.repo, lang)
  );

  if (!pages || pages.length === 0) {
    console.error("❌ Failed to fetch documentation outline.");
    process.exit(1);
  }

  // Download pages with concurrency control
  const results: PageResult[] = [];
  let completed = 0;

  // Simple semaphore using an async queue
  async function downloadPage(page: OutlinePage): Promise<PageResult> {
    try {
      const content = await fetchMarkdownPageByWikiId(wikiId, page.slug, lang);
      // Write to file
      const filePath = path.join(repoDir, `${page.slug}.md`);
      await fs.writeFile(filePath, content, "utf-8");
      completed++;
      process.stdout.write(`\r  Downloading... ${completed}/${pages.length}`);
      return { page, content, success: true };
    } catch (err) {
      completed++;
      process.stdout.write(`\r  Downloading... ${completed}/${pages.length}`);
      return {
        page,
        content: "",
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]!;
      const p = task().then((r) => {
        results[i] = r;
      });
      executing.push(p);

      if (executing.length >= limit) {
        await Promise.race(executing);
        executing.splice(
          0,
          executing.length,
          ...executing.filter((x) => {
            const status = (x as unknown as Promise<void>) as Promise<void>;
            return status;
          })
        );
        // Simpler approach: just wait for the batch
        if (executing.length >= limit) {
          await Promise.race(executing);
        }
      }
    }

    await Promise.all(executing);
    return results;
  }

  // Even simpler: chunk the pages
  const successful: PageResult[] = [];
  const failed: PageResult[] = [];

  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((p) => downloadPage(p)));
    for (const r of batchResults) {
      if (r.success) successful.push(r);
      else failed.push(r);
    }
  }

  process.stdout.write("\n\n");

  // Generate llms.txt (index with relative links)
  await generateLlmsTxt(repoDir, parsed.owner, parsed.repo, pages, successful);

  // Generate llms-full.txt (full content with remote links)
  await generateLlmsFullTxt(repoDir, parsed.owner, parsed.repo, pages, successful);

  // Print summary
  console.log(`✅ Export complete!`);
  console.log(`   Total: ${pages.length} pages`);
  console.log(`   Succeeded: ${successful.length}`);
  console.log(`   Failed: ${failed.length}`);
  console.log();
  console.log(`   📄 Docs directory: ${repoDirName}/`);
  console.log(`   📄 llms.txt (index): ${path.join(repoDirName, "llms.txt")}`);
  console.log(`   📄 llms-full.txt (full content): ${path.join(repoDirName, "llms-full.txt")}`);

  if (failed.length > 0) {
    console.log();
    console.log("Failed pages:");
    for (const f of failed.slice(0, 5)) {
      console.log(`   - ${f.page.slug}: ${f.error}`);
    }
  }
}

async function generateLlmsTxt(
  repoDir: string,
  owner: string,
  repo: string,
  pages: OutlinePage[],
  results: PageResult[]
): Promise<void> {
  const zreadUrl = `https://zread.ai/${owner}/${repo}`;
  const lines: string[] = [];

  lines.push(`# ${owner}/${repo}`);
  lines.push("");
  lines.push(`Source: ${zreadUrl}`);
  lines.push("");

  // Group by section -> group
  const sections = new Map<string, Map<string, OutlinePage[]>>();

  for (const page of pages) {
    const section = page.section || "General";
    const group = page.group || "";

    if (!sections.has(section)) {
      sections.set(section, new Map());
    }
    const sectionMap = sections.get(section)!;

    if (!sectionMap.has(group)) {
      sectionMap.set(group, []);
    }
    sectionMap.get(group)!.push(page);
  }

  for (const [section, groups] of sections) {
    lines.push(`## ${section}`);
    lines.push("");

    for (const [group, groupPages] of groups) {
      if (group) {
        lines.push(`### ${group}`);
        lines.push("");
      }

      for (const page of groupPages) {
        lines.push(`- [${page.title}](${page.slug}.md)`);
      }
      if (group) lines.push("");
    }

    lines.push("");
  }

  await fs.writeFile(path.join(repoDir, "llms.txt"), lines.join("\n"), "utf-8");
}

async function generateLlmsFullTxt(
  repoDir: string,
  owner: string,
  repo: string,
  pages: OutlinePage[],
  results: PageResult[]
): Promise<void> {
  const zreadUrl = `https://zread.ai/${owner}/${repo}`;
  const contentMap = new Map(results.filter((r) => r.success).map((r) => [r.page.slug, r.content]));

  const lines: string[] = [];
  lines.push(`# ${owner}/${repo}`);
  lines.push("");
  lines.push(`Source: ${zreadUrl}`);
  lines.push("");

  // Group by section -> group
  const sections = new Map<string, Map<string, OutlinePage[]>>();

  for (const page of pages) {
    const section = page.section || "General";
    const group = page.group || "";

    if (!sections.has(section)) {
      sections.set(section, new Map());
    }
    const sectionMap = sections.get(section)!;

    if (!sectionMap.has(group)) {
      sectionMap.set(group, []);
    }
    sectionMap.get(group)!.push(page);
  }

  for (const [section, groups] of sections) {
    lines.push(`# ${section}`);
    lines.push("");

    for (const [group, groupPages] of groups) {
      if (group) {
        lines.push(`## ${group}`);
        lines.push("");
      }

      for (const page of groupPages) {
        if (contentMap.has(page.slug)) {
          lines.push(`- [${page.title}](${zreadUrl}/${page.slug})`);
          lines.push("");
          lines.push(contentMap.get(page.slug)!);
          lines.push("");
          lines.push("---");
          lines.push("");
        }
      }
    }
  }

  await fs.writeFile(path.join(repoDir, "llms-full.txt"), lines.join("\n"), "utf-8");
}
