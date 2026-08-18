---
name: backport-resolution
description: You resolve conflicts in Mergify backport PRs onto release/X.X.x branches, keeping the release branch's own state intact and applying only the change being backported. Covers pnpm-config.json, package.json version precedence, changelog placement in NextVersion.md vs X.X.0.md, CI config divergence, and combined backports. Use the `merge-conflict-resolving` skill for the general per-file-type conflict strategies.
---

# Backport Resolution

Resolve merge conflicts in backport PRs from Mergify. Mergify uses **cherry-pick** (not merge) to create backport branches with the pattern `mergify/bp/release/X.X.x/pr-NNNN`. When cherry-pick fails, Mergify comments that the PR is conflicted and the branch must be fixed locally.

**This skill covers what is specific to backports.** For the general per-file-type strategies — lock files, API reports, rush change files, source conflicts, modify/delete conflicts, conflict-marker checks, and the review gate — use the `merge-conflict-resolving` skill alongside this one. Where a file-type strategy there says merge both branches' content, the rule below wins on a release branch: **keep the release branch side, and add only the change being backported.**

**Prerequisite:** This skill references the `cve-remediation` skill for understanding `pnpm-config.json` structure (globalOverrides, ignoreCves). Load that skill when resolving conflicts in security-related backports.

## How Mergify backports work

1. A PR merges to `master`
2. Mergify cherry-picks the commit(s) onto a new branch: `mergify/bp/release/X.X.x/pr-NNNN`
3. If cherry-pick fails, Mergify marks the PR as conflicted and posts a generic comment (it does **not** list specific files — use `git status` locally to identify conflicts)
4. A developer checks out the branch, resolves conflicts, and pushes

To start resolving:

```bash
git fetch origin
git checkout mergify/bp/release/X.X.x/pr-NNNN
git cherry-pick --continue   # If mid cherry-pick
# OR
git merge origin/release/X.X.x  # If syncing with target branch
```

## pnpm-config.json Conflicts

**File:** `common/config/rush/pnpm-config.json`

This is the **most common conflict file** in security backports. It contains `globalOverrides` (dependency version overrides) and `ignoreCves` (audit exceptions). For detailed structure, see the `cve-remediation` skill.

### Resolution Strategy

**Keep all existing entries from the release branch (HEAD). Add new entries from the incoming change.**

1. Open the file and identify the conflicting sections (usually `globalOverrides` or `ignoreCves`)
2. Keep every existing override/exception from the release branch
3. Add the new override/exception being backported from the incoming change
4. Fix JSON syntax — especially trailing commas:
   - The last entry in a JSON object must NOT have a trailing comma
   - When adding a new last entry, add a comma to the previously-last entry

### Example Resolution

Release branch (HEAD) has:

```json
"globalOverrides": {
  "cross-spawn": "^7.0.5",
  "axios": "^1.13.5"
}
```

Incoming change adds `serialize-javascript` override:

```json
"globalOverrides": {
  "cross-spawn": "^7.0.5",
  "axios": "^1.13.5",
  "serialize-javascript": "^7.0.3"
}
```

After resolving, always run `rush update` to regenerate the lock file.

**Examples:** [PR #9007](https://github.com/iTwin/itwinjs-core/pull/9007), [PR #9041](https://github.com/iTwin/itwinjs-core/pull/9041), [PR #9049](https://github.com/iTwin/itwinjs-core/pull/9049)

## Package.json Conflicts in Backports

**Rule:** When backporting to `release/X.X.x`, keep the release branch's version information and only accept new functional changes.

### Keep from Release Branch (HEAD)

- Version numbers: `"version": "5.5.0"`
- Internal workspace dependencies (this repo uses `workspace:*` for internal deps — do not convert to hardcoded versions unless the release branch already uses them)
- Branch-specific scripts and configurations

### Accept from Incoming (master)

- New dependencies being added
- New scripts being added
- External dependency updates (if that's the purpose of the backport)

After resolving, always run `rush update` to regenerate the lock file.

**Avoid:**

- Accepting master's version numbers in release branches
- Forgetting to run `rush update` after editing package.json

## Rush Change Files in Backports

Rush change files rarely conflict, but **if change files are needed for the backport**, generate them non-interactively against the release branch:

```bash
rush change --verify -b origin/release/X.X.x
# If needed:
rush change --bulk --message "" --bump-type none -b origin/release/X.X.x
```

**Example:** [PR #8345](https://github.com/iTwin/itwinjs-core/pull/8345) — had 30+ rush change files for a multi-package backport

## Documentation Conflicts (NextVersion.md)

Resolution depends on whether the target release branch has already shipped its initial release (`X.X.0`).

### Detect: has `X.X.0` already been released?

Check whether a version-specific changelog file already exists on the release branch:

```bash
# For a backport targeting release/5.7.x:
ls docs/changehistory/5.7.0.md
# Or check git tags:
git tag --list 'release/5.7.*'
```

If `X.X.0.md` exists (or the `release/X.X.0` tag exists), the initial release has shipped and `NextVersion.md` on that branch should be empty.

### Scenario A — Initial release has shipped (`X.X.0.md` exists)

On backport branches targeting `release/X.X.x` **after** the `X.X.0` release, `NextVersion.md` on the release branch (HEAD) is intentionally empty. The incoming side from master will have content that was written for the next major/minor release — **not** for this patch branch.

**Resolution:**

1. **Keep `NextVersion.md` empty** — resolve to the HEAD (release branch) side, which has only the frontmatter and heading:
   ```markdown
   ---
   publish: false
   ---

   # NextVersion
   ```
2. **Move relevant entries to `X.X.0.md`** — extract only the changelog entries that correspond to the change being backported (ignore unrelated master content like new features). Place them under the appropriate section in `docs/changehistory/X.X.0.md`.
3. **Determine the right section** — look at the existing structure in `X.X.0.md` and add the entry under the matching category (e.g., `## Display > ### Fixes`). Create a subsection if needed.

**What to discard:** Any incoming `NextVersion.md` content that describes features or changes **not** being backported. These belong on master only.

**Example:** [PR #9059 backport](https://github.com/iTwin/itwinjs-core/pull/9059) — incoming side had both a `WithQueryReader` feature (master-only) and a reality data fix (being backported). Only the fix was moved to `5.7.0.md`.

### Scenario B — Initial release has NOT shipped yet (no `X.X.0.md`)

`NextVersion.md` is still the active changelog for the upcoming release. Merge both versions intelligently, as described in the `merge-conflict-resolving` skill: extract unique sections from both, merge into logical category order, update the table of contents, and remove duplicate content.

### Verification

```bash
rush docs  # Ensure documentation builds
```

**Avoid:**

- Blindly merging master's `NextVersion.md` content into a post-release patch branch
- Discarding backported changelog entries entirely — they must go into `X.X.0.md`
- Leaving mismatched table of contents (Scenario B)
- Keeping duplicate sections

## CI/Config File Conflicts (.github/)

CI workflows and configuration files can diverge significantly between major release branches.

Common conflicting files:

- `.github/workflows/extract-api.yaml` — node version, action versions
- `.github/mergify.yml` — backport target branches
- `.github/workflows/*.yaml` — CI pipeline changes

**Resolution:** Generally keep the release branch's CI configuration. Only accept incoming changes that are specifically being backported (e.g., a node version bump needed for compatibility).

**Example:** [PR #9049](https://github.com/iTwin/itwinjs-core/pull/9049) — needed additional edit to bump node version in `extract-api.yaml` for the older release branch

## Source Code Conflicts (.ts files)

Rare in backports but possible when the same code area was modified on both branches.

**Resolution:**

- Understand the intent of the backported change
- Apply the functional change to the release branch's version of the code
- Do not blindly accept incoming — the release branch may have different surrounding context

## Combined Backports

Sometimes Mergify cannot cherry-pick cleanly because multiple related changes need to land together. In this case, combine the changes into a single backport PR.

**Example:** [PR #9007](https://github.com/iTwin/itwinjs-core/pull/9007) — combined 3 separate PRs into one backport due to dependency conflicts

When combining:

- List all original PR numbers in the PR description
- Ensure all changes are compatible with each other on the release branch
- Sometimes backport-specific edits are needed beyond the original PRs

## Resolution Workflow

1. **Identify conflict type:** Run `git status` to see which files need resolution

2. **Apply strategy:**
   - **pnpm-config.json:** Edit manually → `rush update` → stage both files → commit
   - **package.json:** Edit manually → `rush update` → stage both files → commit
   - **NextVersion.md:** Check if `X.X.0.md` exists → Scenario A (keep empty, move to `X.X.0.md`) or B (merge both) → stage → commit
   - **CI/config files:** Manual edit favoring release branch → stage → commit
   - **Lock file, API files, rush change files, modify/delete:** See the `merge-conflict-resolving` skill

3. **Check for residual conflict markers:**

   ```bash
   grep -r "<<<<<<< " . --include="*.ts" --include="*.json" --include="*.md" --include="*.yaml" --include="*.yml"
   ```

4. **Verify:** Run `rush build` and ensure CI passes

5. **Commit** — for every conflict type except modify/delete, commit directly using the messages below. If a **modify/delete** conflict was resolved, stop for review first (see the review gate in the `merge-conflict-resolving` skill).
   - Lock files: `"resolve pnpm-lock conflicts"`
   - pnpm-config.json: `"resolve pnpm-config.json conflicts in backport"`
   - Package.json: `"resolve package.json conflicts in backport"`
   - API files: `"regenerate api files after backport"`
   - Documentation: `"merge NextVersion.md from both branches"`
   - Multiple files: `"resolve conflicts"`

6. **Continue the cherry-pick and push:**

   ```bash
   git cherry-pick --continue
   git push
   ```

## Rollback

If resolution goes wrong:

```bash
# Abort an in-progress cherry-pick
git cherry-pick --abort

# Or reset to the last good state (before the cherry-pick)
git reset --hard ORIG_HEAD
git clean -fd

# Then re-attempt
rush update
```

## Quick Reference

| File Type         | Path                                  | Resolution                                | Key Points                                                                           |
| ----------------- | ------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| pnpm-config       | `common/config/rush/pnpm-config.json` | Manual edit + `rush update`               | Keep release entries, add new. See `cve-remediation` skill for structure              |
| package.json      | `<package>/package.json`              | Manual edit + `rush update`               | Keep release versions, add new deps only                                              |
| Rush change files | `common/changes/@itwin/*/`            | Generate with `-b origin/release/X.X.x`   | Verify against the release branch, not master                                         |
| NextVersion.md    | `docs/changehistory/NextVersion.md`   | See scenarios A/B                         | If `X.X.0.md` exists: keep empty, move entries to `X.X.0.md`. Otherwise: merge both.  |
| CI/config         | `.github/workflows/*.yaml`            | Manual edit                               | Favor release branch config                                                           |
| Source code       | `*.ts`                                | Apply backported intent to release branch | Do not blindly accept incoming                                                        |

## For Automated Agents

- **Check target branch first** — Strategy differs for `master` vs `release/X.X.x`; this skill applies only to release branch targets
- **Mergify uses cherry-pick** — Recovery is `git cherry-pick --continue`, not merge
- **Keep the release branch side** — Anything in a conflict hunk that is not part of the change being backported stays as the release branch has it
- **Parse structured data** — Extract version fields from package.json programmatically
- **Check whether `X.X.0.md` exists** before resolving `NextVersion.md`
- **Always check for conflict markers** — `grep -r "<<<<<<< " .` before committing
- **Verify after resolution** — Run `rush build`, `rush extract-api`, and check `git diff`
- **Never commit without testing** — Ensure no syntax errors or breaking changes
- **Reference the `cve-remediation` skill** — For understanding pnpm-config.json structure when resolving security backport conflicts
- **Reference the `merge-conflict-resolving` skill** — For lock files, API reports, modify/delete conflicts, and the review gate
