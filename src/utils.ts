/**
 * Utility functions shared across commands.
 */

import chalk from "chalk";
import { RepoInfo, RepoSearchResult } from "./api.js";

// ==============================================================================
// Language resolution
// ==============================================================================

export function resolveLang(input?: string): string {
  if (input === "zh" || input === "en") return input;

  const envLang = process.env.ZREAD_LANG;
  if (envLang === "zh" || envLang === "en") return envLang;

  // Try to detect from system locale
  const systemLocale = process.env.LANG ?? process.env.LC_ALL ?? "";
  if (systemLocale.toLowerCase().startsWith("zh")) return "zh";

  return "zh"; // Default to Chinese
}

// ==============================================================================
// Formatting helpers
// ==============================================================================

export function formatStars(stars: number): string {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1)}k`;
  }
  return String(stars);
}

export function formatRepoList(repos: RepoSearchResult[], startIndex = 1): string {
  const lines: string[] = [];

  for (let i = 0; i < repos.length; i++) {
    const r = repos[i];
    const idx = startIndex + i;
    const url = r.url ?? `https://github.com/${r.owner ?? "unknown"}/${r.name ?? "unknown"}`;
    const stars = r.stars ? ` 🌟 ${formatStars(r.stars)}` : "";
    const lang = r.language ? `\n        🔤 ${r.language}` : "";
    const topics = r.topics?.length ? `  🏷️ ${r.topics.join(", ")}` : "";

    lines.push(
      `  ${idx}\t${url}${stars}`,
      `  \t${r.description ?? ""}${lang}${topics}`,
      ""
    );
  }

  return lines.join("\n");
}

export function formatRepoInfo(data: RepoInfo): string {
  const lines: string[] = [];

  lines.push(chalk.cyan(`\n${data.owner}/${data.name}`));

  if (data.description) {
    lines.push(`  ${data.description}`);
  }

  const meta: string[] = [];
  if (data.language) meta.push(`🔤 ${data.language}`);
  if (data.stars) meta.push(`🌟 ${formatStars(data.stars)}`);
  if (data.topics?.length) meta.push(`🏷️ ${data.topics.join(", ")}`);
  if (meta.length) {
    lines.push(`  ${meta.join("  ")}`);
  }

  if (data.status) {
    const statusColor =
      data.status === "active"
        ? chalk.green
        : data.status === "inactive"
        ? chalk.gray
        : data.status === "progress"
        ? chalk.yellow
        : chalk.gray;
    lines.push(`  Status: ${statusColor(data.status)}`);
  }

  lines.push("");
  return lines.join("\n");
}

export function formatPlainRepoInfo(data: RepoInfo): string {
  const lines: string[] = [];
  lines.push(`Repository: ${data.owner}/${data.name}`);
  if (data.description) lines.push(`Description: ${data.description}`);
  if (data.language) lines.push(`Language: ${data.language}`);
  if (data.stars) lines.push(`Stars: ${data.stars}`);
  if (data.topics?.length) lines.push(`Topics: ${data.topics.join(", ")}`);
  if (data.status) lines.push(`Status: ${data.status}`);
  lines.push("");
  return lines.join("\n");
}

// ==============================================================================
// Simple progress spinner using stdout
// ==============================================================================

export async function withSpinner<T>(message: string, fn: () => Promise<T>): Promise<T> {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let running = true;

  const interval = setInterval(() => {
    if (!running) return;
    process.stdout.write(`\r${frames[i]} ${message}`);
    i = (i + 1) % frames.length;
  }, 80);

  try {
    const result = await fn();
    running = false;
    clearInterval(interval);
    process.stdout.write(`\r✓ ${message}\n`);
    return result;
  } catch (err) {
    running = false;
    clearInterval(interval);
    process.stdout.write(`\r✗ ${message}\n`);
    throw err;
  }
}
