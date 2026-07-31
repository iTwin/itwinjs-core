---
name: dependency-hygiene
description: Audit a package's declared dependencies in the iTwin.js Rush monorepo for unused entries, deprecated/outdated versions, undeclared dependencies and manifest defects, and remove them safely.
---

# Dependency Hygiene Audit

Use when asked whether a package's `dependencies`, `devDependencies` or `peerDependencies` are unused, deprecated or stale, or to clean them up.

**All commands run from the repo root.** Substitute `<package>` with the path under audit, e.g. `core/markup`. A path-relative command run from the wrong directory returns empty output rather than an error — which reads exactly like "no usage found".

## Scope rules

- **Only audit direct dependencies** declared in the package's `package.json`. Transitive dependencies are out of our control — never report them as deprecated findings (transitive *vulnerabilities* are the `cve-remediation` skill).
- Audit one package at a time unless asked to sweep the repo.
- **Usage is judged per package.** A package that imports nothing from a dependency it declares should not declare it, even if ten other packages use it heavily.
- "Unused in code" is **not** sufficient to remove. See Step 3.
- **Know a dependency is unneeded before removing it — never remove it to find out.** Removal requires affirmative evidence up front: the commit that deleted its last import, or a resolution proof (Step 4.4). `rush update`, `check`, `build` and `lint` all pass on a bad removal.
- **A removal is not validated until the package's tests pass** (Step 9.5). Test tooling is the category most often flagged unused and the only one no build or lint exercises.

## Step 1 — Read the manifest

Read `<package>/package.json` in full: all three dependency blocks **and** every `scripts` entry, since scripts are the main source of non-code usage.

## Step 2 — Find code usage

```bash
grep -rnE "(^import|^export|require\(|import\(|from \")" <package>/src/ | grep -vE "from \"\.|import\(\"\.|from '\."
```

**`import\(` is load-bearing.** A dynamic `await import("<dep>")` has no line-leading `import`, no `require(` and no `from "`. Omitting it silently misses the only usage a dependency may have — `@loaders.gl/draco` is a runtime dep of `core/frontend` whose sole consumers are three dynamic imports. Lazily loaded decoders, workers and polyfills are loaded this way.

If the grep returns nothing, confirm the path before believing it: `ls <package>/src >/dev/null || echo "wrong path"`.

Also check `.js` and JSON configs a `src/` grep misses: webpack configs, `.mocharc.json`, `certa.json`, `eslint.config.js`, `tsconfig.json`.

## Step 3 — Legitimate non-code usage

| Reason | How to confirm |
| --- | --- |
| CLI binary used by a script | Match script command to package (`cpx2` → `cpx`, `rimraf`, `@itwin/build-tools` → `betools`, `@itwin/certa` → `certa`, `webpack-cli` → `webpack`) |
| Type-only package consumed by `tsc` | `@types/*` backing test or runtime globals (`@types/mocha`, `@types/node`) |
| Config or plugin resolved by name at runtime | eslint plugins/configs, webpack loaders, mocha reporters |
| Satisfies another package's `peerDependencies` | Step 4.2 — do not eyeball it, and a hit is not automatically decisive |
| A `peerDependency` mirrored into `devDependencies` | Standard and required here — a package must dev-install its own peers |

## Step 4 — Confirm a dependency is genuinely unused

Run checks 1–4. Check 5 is optional and gated on user consent.

**1. Owning-package usage check (decides the verdict).** No imports from Step 2 and no non-code usage from Step 3, *within this package*.

**2. Reverse peer scan (mandatory).** A dependency with no imports may exist solely to satisfy another package's peers. Never assert "not a peer" from a name grep:

```bash
awk '
/^  [^ ]/ { pkg=$0; inpeer=0 }
/^    peerDependencies:/ { inpeer=1; next }
/^    [^ ]/ { if ($1 != "peerDependencies:") inpeer=0 }
inpeer && /<dep-name>/ { print pkg " -> " $0 }
' common/config/rush/pnpm-lock.yaml
```

Empty output clears the candidate. **A hit is not automatically a veto** — it demotes the candidate to "needs verification". Check three things:

- **Unformed link** — if the peer name is absent from the depending package's `snapshots` entry, the requirement is inert. (`debug` hit `follow-redirects@1.16.0 -> debug: '*'`, but its snapshot was `{}`.)
- **Optional peer** — the awk scan cannot see `peerDependenciesMeta`. Read the depending package's `package.json`; an optional peer it already satisfies from its own deps is not a veto. (`mocha` is an optional peer of `@itwin/build-tools`, which installs its own copy.)
- **Sibling proof** — another package running the same tooling without declaring it. (`core/i18n` runs the same `certa -r chrome` + build-tools reporter setup without `mocha`.)

Only a **confirmed live peer link** vetoes removal: the dependency named in a resolved key's parenthesised suffix, e.g. `@loaders.gl/draco@4.3.4(@loaders.gl/core@4.3.4)`. Quote that key. A dependency merely listed under another package's `dependencies:` in `snapshots` resolves its own copy and is independent of this audit. A hit cleared as inert has no deleted import behind it and **must** go through check 4.

**3. Blast-radius check (never the verdict).** Establish who else is involved:

```bash
grep -n "<dep-name>" common/config/rush/pnpm-lock.yaml
```

This is a **substring** match, as is the peer scan — auditing `debug` also hits `@types/debug`. Confirm whole package names before drawing conclusions. Do not try to anchor it to `<dep>@`: importer lines are `      cpx2:` and snapshot keys are `  cpx2@8.0.2:`, so an anchored pattern silently returns nothing.

- Other `importers` entries mean other packages declare it independently; removing it here does not affect them.
- Hits in other packages' `.rush/temp/shrinkwrap-deps.json` do **not** prove they receive it through this package. **Trace the path**: read their `package.json` for another dependency pulling it in — a sibling `@itwin/*` is the usual culprit. Only when no other route exists does removal affect them. These files are read-only evidence; `**/.rush` is gitignored.

**4. Resolution proof (mandatory when there is no deleted import).** Dependencies invoked *by name at runtime* — runners, reporters, loaders, plugins, CLI binaries — leave no trace for checks 1–3. "No imports found" is absence of evidence, not evidence of absence.

Name every consumer, then prove each resolves its own copy. Find the requiring files:

```bash
grep -rn "require(\"<dep>\")\|require('<dep>')\|from \"<dep>\"" <consumer-package>/src
```

Resolve **from the directory of the file issuing the `require`**, not the consumer's main entry — under pnpm those sit on different `node_modules` chains and can disagree:

```bash
node -e "
const path = require('path');
const requiringFile = require.resolve('<path/from/the/grep/hit>');
console.log(require.resolve('<dep>', { paths: [path.dirname(requiringFile)] }));
"
```

A path under `common/temp/node_modules/.pnpm/...` means the consumer carries its own copy and this package's declaration is redundant. `Cannot find module` means it is load-bearing — **keep it**.

Resolving from the audited package itself proves nothing and produces false alarms: after removal `require.resolve("mocha")` from `core/markup` correctly fails, which says only that markup has no copy.

If any consumer cannot be shown to resolve its own copy, do not remove. Record the proof in the report.

**5. History check (optional — ask first).** Archaeology, not evidence; checks 1–4 decide the verdict. `git log -S` is slow, so ask once and batch all candidates rather than prompting per dependency.

```bash
git --no-pager log --oneline --all -S'<dep-name>' -- '<package>/src/**'
git --no-pager log --oneline -S'"<dep-name>"' -- <package>/package.json
```

Scope the first search to the package under audit; widening it repo-wide makes a dead dependency look alive. A last usage deleted by a commit that never touched this `package.json` is a confirmed leftover; `git show --stat` names the removed feature.

Classify each result, since the category sets how much validation is needed:

| Category | Signature | Risk |
| --- | --- | --- |
| Creation-time boilerplate | Zero commits over `<package>/src/**` — never imported | Lowest |
| Incomplete migration cleanup | A commit deleted the last import but not the manifest entry | Run the tests; the migration may have missed more |
| Script or tooling change | Never imported; the invoking script was rewritten | Confirm no script still references the binary |

Do not generalise one migration across the whole set — a package still running `certa`/`mocha` was never migrated to Vitest whatever the rest of the repo did.

## Step 5 — Check for deprecation

**`npm view <pkg> deprecated` reports the `latest` line, not what you have installed.** Never pass a semver range — it returns every matching version.

Triage against `latest`, then confirm every hit against the resolved version from `pnpm-lock.yaml`:

```bash
# TRIAGE ONLY — reports `latest`
for p in <dep> <dep>; do echo "$p latest=$(npm view $p version) deprecated=$(npm view $p deprecated)"; done

# VERDICT — resolved versions
for p in <dep>@<resolved> <dep>@<resolved>; do echo "$p deprecated=[$(npm view $p deprecated 2>/dev/null)]"; done
```

Skipping the second pass nearly removed `@types/flatbuffers`: `latest` (2.0.1) carries a stub-types deprecation, resolved 1.10.3 carries none.

**When the resolved version is deprecated, probe its neighbours** to distinguish a botched publish from an abandoned line — the remediation differs completely:

```bash
for v in <resolved-minus-one> <resolved> <next-major-latest> <latest>; do
  echo "<pkg>@$v deprecated=[$(npm view <pkg>@$v deprecated 2>/dev/null)]"
done
```

- *Single bad release* — neighbours clean. `sinon@17.0.2` is deprecated with the message literally `There`; 17.0.1 and all of 18.x–22.x are clean. Note `^17.0.1` still resolves to 17.0.2, so dodging it needs an exact pin. "Accept the cosmetic flag" is a legitimate outcome.
- *Line abandoned* — the whole major is flagged; a real migration is needed.

**Never trust a stub-types deprecation message.** "X provides its own type definitions" describes `latest` and is often false for older lines. Verify against the resolved runtime package:

```bash
npm view <runtime-pkg>@<resolved-version> types typings
```

Both outcomes occur here from an identical message: `@types/i18next` is removable (`i18next@21.10.0` ships types); `@types/flatbuffers` must **stay** (`flatbuffers@1.12.0` ships none, so removal breaks `tsc`). Report a blocked stub with the upgrade that would unblock it.

**Before proposing any bump, count declarations repo-wide.** `rush check` enforces one version across the monorepo, so a bump is never local:

```bash
grep -rn '"<dep-name>"' --include=package.json --exclude-dir=node_modules . | grep -v common/temp
```

`sinon: ^17.0.2` looks like a two-package fix but is declared by **16 packages**, with `@types/sinon` mirrored across the same 16 — all must move together. Check whether a matching `@types/*` moves in lockstep.

Report as: **deprecated** (resolved version flagged — must be addressed), **deprecated at `latest` only** (informational), or **behind a major** (informational; confirm the lag is unintentional — `chai` 4 and `@types/chai` 4 are pinned deliberately because chai 5+ is ESM-only. A repo-wide constraint is not a per-package finding).

## Step 6 — Manifest defects

Not "unused" under any Step 4 check, but still wrong:

- **Duplicate declarations across blocks** — same package in both `dependencies` and `devDependencies`. Drop the devDeps copy. (Found in `core/backend`: `fs-extra`.)
- **Orphaned tool config blocks** — after removing a tool, grep the manifest for its config key (`nyc`, `jest`, `mocha`, `eslintConfig`, `browserslist`) and remove the block too.
- **`@types/*` badly out of step with its runtime package** — e.g. `@types/fs-extra@^4` describing `fs-extra@^8`.

## Step 7 — Undeclared dependencies (the inverse finding)

Names imported or resolved but **not declared**, working only because a sibling hoists them. Any hoisting change breaks the build outright — often higher risk than anything you remove.

```bash
grep -rnoE "require\(['\"][^.'\"][^'\"]*['\"]\)|from ['\"][^.'\"][^'\"]*['\"]" <package>/src <package>/*.js 2>/dev/null | sort -u
```

Check webpack configs, test setup scripts, and loader/plugin names resolved as strings. Also check peers of build tooling — `babel-loader@8` requires `@babel/core`. Report separately; the fix is **add**, not remove.

## Step 8 — Report

Table every direct dependency with declared range, resolved version, latest version and verdict. Separate confirmed findings from informational notes. For each proposed removal:

- Quote the Step 4.2 peer scan result. If a hit was cleared, quote the evidence that cleared it.
- Describe blast radius only in terms of paths actually traced.
- If there was no deleted import, record the Step 4.4 resolution proof: each consumer and the path it resolves from. A removal with neither a deleted import nor a resolution proof is unsubstantiated — report it as an open question, not a finding.
- If the history check ran, cite the orphaning commit and its category.

Keep separate tables, since each has a different fix: unused (remove) · deprecated on resolved (bump/migrate) · deprecated at `latest` or blocked (follow-up) · behind a major (informational) · manifest defects (fix in place) · undeclared (**add**).

Count the entries you actually changed against the diff rather than restating an earlier estimate.

When removals are applied, close with an explicit validation status naming what ran **and what did not**:

```
rush update ✅   rush check ✅   rush build ✅   rush lint ✅
tests ❌ NOT RUN — core/markup, core/common unvalidated
```

A removal whose suite has not run is **unvalidated** however many other checks are green. Never summarise such a change as "validated".

## Step 9 — Removal (only when asked)

Removal is a real change with consumer impact, because downstream apps may rely on hoisting.

**The Rush commands below do not validate that a removal was correct.** They confirm you did not break the build; they cannot tell you whether you deleted something needed:

| Command | Why it cannot catch a bad removal |
| --- | --- |
| `rush update` | Unmet **optional** peers are skipped silently; only a *required* peer prints `unmet peer` |
| `rush check` | Compares version strings across manifests; a removed entry has nothing left to compare |
| `rush build` | `tsc` sees only the compile graph — runners, reporters, loaders and CLI binaries are not in it |
| `rush lint` | eslint never loads the package |

All four pass whether or not the removal was correct. Hence the proof in Step 4.4 before the edit, and the mandatory tests in 5 below.

1. Drop the confirmed entries from `package.json`, plus any orphaned tool config block (Step 6).
2. `rush update` from the repo root — never `npm install`, `pnpm install`, or a hand edit of `pnpm-lock.yaml`.
3. `rush check` for version consistency.
4. `rush build --to <package>` and `rush lint --to <package>`.

   **Capture any baseline before editing, never after.** Lint is type-aware and runs against build output, so `git stash` + re-lint lints stale artifacts against reverted sources. Without a prior baseline, instead verify every remaining warning sits in a file you did not touch.

5. **Run the tests. Mandatory — this completes the validation.**

   ```bash
   rush test --to <package>
   ```

   Run it for **every** package whose manifest you edited, not only those where a test dependency was removed. Read the package's `scripts` first, since suites are not uniform: `vitest` packages run directly; `certa` packages chain a bundling step (`npm run -s webpackTests && certa -r chrome`) and need a working Chrome; an empty `test` script means nothing to run — say so rather than implying a suite passed. Related: `rush cover --to` and `rush webpack:test --to`.

   **If a suite cannot be run, stop and tell the user which package is unvalidated and why.** An unrunnable suite is a reason to pause, not to proceed quietly. A failing test is evidence about the removal until a clean-checkout re-run says otherwise.

6. Review the lockfile diff rather than assuming pure deletion — removing devDeps can *add* lines when a peer-suffixed snapshot key changes (e.g. `@vitest/*` flipping their `@opentelemetry/api` suffix). Confirm both variants still exist and that packages needing the old one still resolve to it.
7. Commit the regenerated `common/config/rush/pnpm-lock.yaml` with the manifest edit. Do **not** commit `.rush/temp/shrinkwrap-deps.json` — `**/.rush` is gitignored (`.gitignore:28`).

**Do not run `rush change` yourself.** It is interactive and the CLI handles it poorly. Stop and tell the user:

> A Rush change file is still needed for this published package. Please run `rush change`. This repo uses `"type": "none"`. Describe the concrete user-facing effect rather than a vague label.

Flag for their judgement in the change file:

- A removed runtime `dependencies` entry is no longer installed transitively, so consumers relying on hoisting must declare it themselves.
- Any package identified in Step 4.3 as receiving the dependency **only** through this one — and only when you traced that path and ruled out every other route.
