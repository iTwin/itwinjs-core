// Checks the structure of a change notes file (default: docs/changehistory/NextVersion.md).
//
// Usage:
//   node .github/workflows/automation-scripts/check-nextversion.mjs [file ...]   check files
//   node .github/workflows/automation-scripts/check-nextversion.mjs --sections   list the allowed sections

import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** The only allowed `##` sections, in the order they must appear. */
const sections = [
  { name: "Frontend", covers: "core-frontend, display, tools, map layers, frontend-only packages" },
  { name: "Backend", covers: "core-backend, ECDb, ECSQL, editing, workspaces" },
  { name: "Common", covers: "core-common, core-bentley, shared RPC and IPC types" },
  { name: "Schemas", covers: "ecschema-* packages" },
  { name: "Geometry", covers: "core-geometry" },
  { name: "Quantity", covers: "core-quantity, quantity formatting" },
  { name: "Presentation", covers: "presentation-* packages" },
  { name: "Electron", covers: "core-electron APIs" },
  { name: "Platform support", covers: "Node.js, Electron, and browser version support; build tooling" },
  { name: "API deprecations", covers: "deprecated APIs and their replacements" },
  { name: "Breaking changes", covers: "breaking changes, including migration guidance" },
];

const sectionNames = sections.map((s) => s.name);

/** Reduces `[text](target)` to `text` so headings that contain links compare equal to their TOC entries. */
const plain = (text) => text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();

/** Returns the headings (outside frontmatter and code fences) and the table of contents entries before the first `##`. */
function parse(text) {
  const lines = text.split(/\r?\n/);
  const headings = [];
  const toc = [];
  let fence;
  let inFrontmatter = lines[0] === "---";
  let beforeFirstSection = true;

  for (let i = inFrontmatter ? 1 : 0; i < lines.length; i++) {
    const line = lines[i];
    if (inFrontmatter) {
      inFrontmatter = line !== "---";
      continue;
    }

    const fenceMarker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (fenceMarker && (!fence || (fenceMarker[0] === fence[0] && fenceMarker.length >= fence.length))) {
      fence = fence ? undefined : fenceMarker;
      continue;
    }
    if (fence)
      continue;

    const heading = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      beforeFirstSection &&= level !== 2;
      headings.push({ level, text: plain(heading[2]), line: i + 1 });
      continue;
    }

    const tocEntry = beforeFirstSection && /^(\s*)[-*]\s+\[(.+)\]\(#[^)]*\)\s*$/.exec(line);
    if (tocEntry)
      toc.push({ level: Math.floor(tocEntry[1].length / 2) + 1, text: plain(tocEntry[2]), line: i + 1 });
  }

  return { headings, toc };
}

/** Returns one message per structural problem in `text`; an empty array means the file is valid. */
function checkChangeNotes(text) {
  const { headings, toc } = parse(text);
  const errors = [];

  let previous;
  let section;
  const sectionLines = new Map();
  let entryLines = new Map();
  for (const h of headings) {
    if (h.level === 1)
      continue;

    if (h.level === 2) {
      section = h;
      entryLines = new Map();
      const rank = sectionNames.indexOf(h.text);
      if (rank < 0)
        errors.push(`line ${h.line}: "## ${h.text}" is not an allowed section. Move its entries under an allowed section as "###" headings.`);
      else if (sectionLines.has(h.text))
        errors.push(`line ${h.line}: "## ${h.text}" repeats the section at line ${sectionLines.get(h.text)}. Move its entries into that section.`);
      else {
        if (previous && previous.rank > rank)
          errors.push(`line ${h.line}: "## ${h.text}" must come before "## ${previous.text}" (line ${previous.line}).`);
        sectionLines.set(h.text, h.line);
        previous = { ...h, rank };
      }
      continue;
    }

    if (!section) {
      errors.push(`line ${h.line}: "${"#".repeat(h.level)} ${h.text}" must be inside an allowed "##" section.`);
      continue;
    }

    if (h.level === 3) {
      if (entryLines.has(h.text))
        errors.push(`line ${h.line}: "### ${h.text}" repeats the entry at line ${entryLines.get(h.text)} in "## ${section.text}". Merge the two entries.`);
      else
        entryLines.set(h.text, h.line);
    }
  }

  if (toc.length > 0) {
    const tocDepth = Math.max(...toc.map((e) => e.level));
    const expected = headings.filter((h) => h.level <= tocDepth);
    for (let i = 0; i < Math.max(expected.length, toc.length); i++) {
      const heading = expected[i];
      const entry = toc[i];
      if (heading?.text === entry?.text && heading?.level === entry?.level)
        continue;

      const want = heading ? `"${heading.text}" at level ${heading.level} (line ${heading.line})` : "no more entries";
      const got = entry ? `"${entry.text}" at level ${entry.level} (line ${entry.line})` : "nothing";
      errors.push(`table of contents does not match headings: expected ${want}, found ${got}.`);
      break;
    }
  }

  return errors;
}

function printSections(print) {
  for (const s of sections)
    print(`  ## ${s.name.padEnd(18)} ${s.covers}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes("--sections")) {
    console.log("Allowed sections, in order:");
    printSections(console.log);
    process.exit(0);
  }

  let failed = false;
  for (const file of args.length > 0 ? args : ["docs/changehistory/NextVersion.md"]) {
    const errors = checkChangeNotes(fs.readFileSync(file, "utf8"));
    failed ||= errors.length > 0;
    if (errors.length === 0)
      console.log(`${file}: OK`);
    for (const error of errors)
      console.error(`${file}: ${error}`);
  }

  if (failed) {
    console.error("\nAllowed sections, in order:");
    printSections(console.error);
    process.exit(1);
  }
}
