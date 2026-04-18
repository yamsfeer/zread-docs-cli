#!/usr/bin/env node
/**
 * zread-ts CLI Entry Point
 *
 * A TypeScript rewrite of the zread CLI tool for browsing zread.ai
 * repository documentation. Works without requiring authentication tokens.
 */

import { program } from "commander";
import { findCommand } from "./commands/find.js";
import { statCommand } from "./commands/stat.js";
import { lsCommand } from "./commands/ls.js";
import { catCommand } from "./commands/cat.js";
import { cpCommand } from "./commands/cp.js";

program
  .name("zread-docs")
  .description("Browse and export zread.ai repository documentation")
  .version("1.0.0");

// ─── find: Search GitHub repositories ────────────────────────────────────────
program
  .command("find <query>")
  .description("Search GitHub repositories on zread.ai")
  .option("-l, --lang <lang>", 'Language: "zh" or "en"', undefined)
  .option("--limit <n>", "Maximum results to show", parseInt)
  .action(async (query: string, options: { lang?: string; limit?: number }) => {
    try {
      await findCommand(query, {
        lang: options.lang,
        limit: options.limit,
      });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ─── stat: Show repository info ──────────────────────────────────────────────
program
  .command("stat <repo>")
  .description("Show repository information and indexing status")
  .option("-l, --lang <lang>", 'Language: "zh" or "en"', undefined)
  .option("-j, --json", "Output as JSON", false)
  .option("-p, --plain", "Output in plain text", false)
  .action(async (repo: string, options: { lang?: string; json?: boolean; plain?: boolean }) => {
    try {
      await statCommand(repo, {
        lang: options.lang,
        json: options.json,
        plain: options.plain,
      });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ─── ls: Show documentation outline ──────────────────────────────────────────
program
  .command("ls <repo>")
  .description("Show the documentation outline (table of contents)")
  .option("-l, --lang <lang>", 'Language: "zh" or "en"', undefined)
  .action(async (repo: string, options: { lang?: string }) => {
    try {
      await lsCommand(repo, { lang: options.lang });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ─── cat: Read a documentation page ──────────────────────────────────────────
program
  .command("cat <repo> <slug>")
  .description("Read a documentation page as Markdown")
  .option("-l, --lang <lang>", 'Language: "zh" or "en"', undefined)
  .action(async (repo: string, slug: string, options: { lang?: string }) => {
    try {
      await catCommand(repo, slug, { lang: options.lang });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ─── cp: Export documentation locally ────────────────────────────────────────
program
  .command("cp <repo> [outputDir]")
  .description("Export all documentation pages to local files")
  .option("-l, --lang <lang>", 'Language: "zh" or "en"', undefined)
  .option("-c, --concurrency <n>", "Concurrent download limit", parseInt)
  .action(
    async (
      repo: string,
      outputDir: string | undefined,
      options: { lang?: string; concurrency?: number }
    ) => {
      try {
        await cpCommand(repo, {
          lang: options.lang,
          concurrency: options.concurrency,
          outputDir,
        });
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }
  );

program.parse();
