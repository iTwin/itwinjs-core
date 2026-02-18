---
name: merge-conflict-resolving
description: You resolve merge conflicts in code repositories, ensuring that the final merged code is functional and free of errors, and adheres to our code quality standards.
---

# Merge Conflict Resolution

Resolve merge conflicts in backport PRs from Mergify. Conflicts typically occur in three file types: lock files, package.json, and documentation.

Use the custom agent for this workflow: [`.github/agents/backport-conflict-resolver.agent.md`](../../agents/backport-conflict-resolver.agent.md).

## Lock Files (pnpm-lock.yaml)

**Always regenerate lock files. Never manually edit them.**

```bash
rush update
# or for persistent issues:
rush update --full
```

Commit with: `git commit -m "resolve pnpm-lock conflicts"`

**Examples:** [PR #8902](https://github.com/iTwin/itwinjs-core/pull/8902), [PR #8954](https://github.com/iTwin/itwinjs-core/pull/8954)

## Package.json Conflicts in Backports

**Rule:** When backporting to `release/X.X.x`, keep the release branch's version information and only accept new functional changes.

### Keep from Release Branch (HEAD)

- Version numbers: `"version": "5.5.0"`
- Internal workspace dependencies: `"@itwin/core-common": "5.5.0"`
- Branch-specific scripts and configurations

### Accept from Incoming (master)

- New dependencies being added
- New scripts being added
- External dependency updates (if that's the purpose of the backport)

### Example Resolution

Backporting a new dependency to release/5.5.x:

```json
{
	"name": "@itwin/core-frontend",
	"version": "5.5.0", // ← Keep release branch version
	"dependencies": {
		"@itwin/core-common": "5.5.0", // ← Keep internal deps from release branch
		"@loaders.gl/core": "^4.3.4" // ← Add new dependency from incoming
	}
}
```

After resolving, always run `rush update` to regenerate the lock file.

**Avoid:**

- Accepting master's version numbers in release branches
- Forgetting to run `rush update` after editing package.json

## Documentation Conflicts (NextVersion.md)

**Merge both versions intelligently.** Preserve unique content from both branches, organize by category, and maintain the table of contents.

### Resolution Process

1. Extract unique sections from both versions
2. Merge into logical category order
3. Update table of contents to match headers
4. Remove duplicate content

Example: If one branch adds Electron support and another adds Presentation changes, include both sections in the proper order.

Verify after resolving:

```bash
npx markdownlint docs/changehistory/NextVersion.md
rush docs  # Ensure documentation builds
```

**Avoid:**

- Discarding content from either version
- Leaving mismatched table of contents
- Keeping duplicate sections

## Resolution Workflow

1. **Identify conflict type:** Run `git status` to see which files need resolution

2. **Apply strategy:**
    - **Lock file:** `rush update` → stage → commit
    - **package.json:** Edit manually → `rush update` → stage both files → commit
    - **NextVersion.md:** Merge both versions → verify formatting → stage → commit

3. **Verify:** Run `rush build` and ensure CI passes

4. **Commit messages:**
    - Lock files: `"resolve pnpm-lock conflicts"`
    - Package.json: `"resolve package.json conflicts in backport"`
    - Documentation: `"merge NextVersion.md from both branches"`
    - Multiple files: `"resolve conflicts"`

## Quick Reference

| File Type                 | Resolution                  | Key Points                               |
| ------------------------- | --------------------------- | ---------------------------------------- |
| `pnpm-lock.yaml`          | `rush update`               | Never manually edit                      |
| `package.json` (backport) | Manual edit + `rush update` | Keep release versions, add new deps only |
| `NextVersion.md`          | Manual merge                | Combine both, organize by category       |

## For Automated Agents

- **Check target branch first** - Strategy differs for `master` vs `release/X.X.x`
- **Parse structured data** - Extract version fields from package.json programmatically
- **Verify after resolution** - Run `rush build`, `rush extract-api`, and check `git diff`
- **Never commit without testing** - Ensure no syntax errors or breaking changes
