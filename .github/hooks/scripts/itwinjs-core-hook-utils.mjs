import { readFile } from "node:fs/promises";

export async function readHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const input = Buffer.concat(chunks).toString("utf8").trim();
  if (!input) {
    return {};
  }

  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

export function parseToolArgs(toolArgs) {
  if (!toolArgs) {
    return {};
  }

  if (typeof toolArgs === "object") {
    return toolArgs;
  }

  if (typeof toolArgs === "string") {
    try {
      return JSON.parse(toolArgs);
    } catch {
      return { raw: toolArgs };
    }
  }

  return {};
}

export function getBashCommand(input) {
  const args = parseToolArgs(input.toolArgs);
  return typeof args.command === "string" ? args.command : "";
}

export function isGitCommitCommand(command) {
  return /\bgit\s+(?:-[^\s]+\s+)*commit\b/.test(command);
}

export function getChangedPathText(input) {
  const args = parseToolArgs(input.toolArgs);
  const directPath = args.file_path ?? args.path ?? "";
  return `${directPath}\n${JSON.stringify(args)}`;
}

export function getChangedPaths(input) {
  const args = parseToolArgs(input.toolArgs);
  return [args.file_path, args.path].filter((path) => typeof path === "string" && path.length > 0);
}

export function isPackageJsonPath(path) {
  return String(path).split(/[\\/]/).pop() === "package.json";
}

export function isWriteLikeTool(toolName) {
  return /^(edit|create|write|apply_patch)$/i.test(String(toolName ?? ""));
}

export function compactJson(value) {
  return `${JSON.stringify(value)}\n`;
}

export async function pathExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
