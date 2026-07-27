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
  const summary = getPathSummary(args);

  try {
    const summaryText = Object.keys(summary).length > 0 ? JSON.stringify(summary) : "";
    return summaryText ? `${directPath}\n${summaryText}` : `${directPath}\n`;
  } catch {
    return `${directPath}\n`;
  }
}

export function getChangedPaths(input) {
  const args = parseToolArgs(input.toolArgs);
  const paths = [];
  for (const value of [args.file_path, args.path, args.old_path, args.new_path, args.paths, args.files]) {
    if (typeof value === "string" && value.length > 0) {
      paths.push(value);
    } else if (Array.isArray(value)) {
      paths.push(...value.filter((entry) => typeof entry === "string" && entry.length > 0));
    }
  }

  return paths;
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

function getPathSummary(args) {
  const summary = {};
  for (const key of ["file_path", "path", "old_path", "new_path", "paths", "files"]) {
    const value = args?.[key];
    if (typeof value === "string" && value.length > 0) {
      summary[key] = value;
    } else if (Array.isArray(value)) {
      const paths = value.filter((entry) => typeof entry === "string" && entry.length > 0);
      if (paths.length > 0) {
        summary[key] = paths;
      }
    }
  }

  return summary;
}
