#!/usr/bin/env node
// Scans app/, components/ and lib/ for t("key", "English fallback", ...)
// call sites (from lib/i18n/server.ts's getTranslator or
// components/i18n/locale-provider.tsx's useTranslations) and syncs:
//   - lib/i18n/locales/en.json — fully regenerated from the fallback text
//     found in source, since the code is the source of truth for English.
//   - lib/i18n/locales/ja.json — existing translations are kept; new keys
//     are added with an empty string for a translator to fill in; keys no
//     longer used in source are left in place (reported, not deleted) so a
//     translation is never silently lost.
//
// Run with: npm run i18n:extract

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const scanDirs = ["app", "components", "lib"];
const extensions = new Set([".ts", ".tsx"]);
const skipDirs = new Set(["node_modules", ".next", ".history", "locales"]);

const CALL_RE =
  /\bt\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*,\s*(['"`])((?:\\.|(?!\3).)*)\3/g;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (extensions.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

function unescape(value) {
  return value.replace(/\\(.)/g, "$1");
}

const found = new Map(); // key -> { fallback, files: Set<string> }
const conflicts = [];

for (const dir of scanDirs) {
  const files = walk(join(rootDir, dir));
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(CALL_RE)) {
      const key = unescape(match[2]);
      const fallback = unescape(match[4]);
      const relFile = file.slice(rootDir.length);

      const existing = found.get(key);
      if (existing) {
        existing.files.add(relFile);
        if (existing.fallback !== fallback) {
          conflicts.push({ key, a: existing.fallback, b: fallback, file: relFile });
        }
      } else {
        found.set(key, { fallback, files: new Set([relFile]) });
      }
    }
  }
}

const enPath = join(rootDir, "lib/i18n/locales/en.json");
const jaPath = join(rootDir, "lib/i18n/locales/ja.json");
const existingJa = JSON.parse(readFileSync(jaPath, "utf8"));

const sortedKeys = [...found.keys()].sort();

const nextEn = {};
const nextJa = {};
for (const key of sortedKeys) {
  nextEn[key] = found.get(key).fallback;
  nextJa[key] = existingJa[key] ?? "";
}

const staleJaKeys = Object.keys(existingJa).filter((key) => !found.has(key));
for (const key of staleJaKeys) {
  nextJa[key] = existingJa[key];
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

writeJson(enPath, nextEn);
writeJson(jaPath, nextJa);

const untranslated = sortedKeys.filter((key) => !nextJa[key]);

console.log(`i18n:extract — scanned ${scanDirs.join(", ")}`);
console.log(`  ${sortedKeys.length} keys found in source`);
console.log(`  ${untranslated.length} keys missing a Japanese translation`);
if (staleJaKeys.length > 0) {
  console.log(
    `  ${staleJaKeys.length} keys in ja.json are no longer used in source (kept, not deleted):`,
  );
  for (const key of staleJaKeys) console.log(`    - ${key}`);
}
if (conflicts.length > 0) {
  console.log(`  ⚠ ${conflicts.length} key(s) used with different fallback text:`);
  for (const conflict of conflicts) {
    console.log(`    - "${conflict.key}" in ${conflict.file}: "${conflict.a}" vs "${conflict.b}"`);
  }
}
