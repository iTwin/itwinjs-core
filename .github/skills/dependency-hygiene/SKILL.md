---
name: dependency-hygiene
description: Audit a package's declared dependencies in the iTwin.js Rush monorepo for unused entries and deprecated/outdated versions, and remove them safely.
---

# Dependency Hygiene Audit

Use this skill when asked to check whether a package's `dependencies`, `devDependencies`, or `peerDependencies` are unused, deprecated, or stale, or to clean them up.

## Scope rules

- **Only audit direct dependencies declared in the package's `package.json`.** Transitive dependencies are out of our control; do not report them as deprecated findings. (Transitive *vulnerabilities* are a different concern — see the `cve-remediation` skill.)
- Audit one package at a time unless explicitly asked to sweep the repo.
- "Unused in code" is **not** sufficient to declare a dependency removable. See "Legitimate non-code usage" below.

## Step 1 — Read the manifest

Read `<package>/package.json` in full. Note every entry in all three dependency blocks **and** every `scripts` entry, since scripts are the main source of non-code usage.

## Step 2 — Find code usage

Search the package source for external imports, ignoring relative ones:

```bash
grep -rnE "^import|require\(|from \"" src/ | grep -vE "from \"\.|from '\."
```

Also check `.js` and JSON config files that a `src/` grep may miss (webpack configs, `.mocharc.json`, `certa.json`, `eslint.config.js`, `tsconfig.json`).

## Step 3 — Legitimate non-code usage

Before flagging anything, confirm it is not needed for one of these reasons:

| Reason | How to confirm |
| --- | --- |
| Provides a CLI binary used by a script | Match the script command to the package (`cpx2` → `cpx`, `rimraf`, `@itwin/build-tools` → `betools`, `@itwin/certa` → `certa`, `webpack-cli` → `webpack`) |
| Type-only package consumed by `tsc` | `@types/*` entries backing test or runtime globals (`@types/mocha`, `@types/chai`, `@types/node`) |
| Config or plugin resolved by name at runtime | eslint plugins and configs, webpack loaders, mocha reporters |
| Satisfies another dependency's `peerDependencies` | Run the reverse peer scan in Step 4 check 2. Do not eyeball it — see the warning there |
| A `peerDependency` mirrored into `devDependencies` | Standard and required in this monorepo — a package must dev-install its own peers to build and test |

## Step 4 — Confirm a dependency is genuinely unused

**Usage is judged per package, not repo-wide.** Every package declares its own dependencies, so a package that imports nothing from a dependency it declares should not declare it — even if ten other packages use that same dependency heavily. Never clear a candidate just because the name appears somewhere else in the repo.

For each candidate, run checks 1, 2 and 3; check 4 is optional and gated on the user's consent:

1. **Owning-package usage check (decides the verdict)** — no imports from Step 2, and no non-code usage from Step 3, *within this package*. That alone makes the dependency unused **for this package**.
2. **Reverse peer scan (mandatory — can veto removal)** — a dependency with no imports anywhere may still exist solely to satisfy some *other* package's `peerDependencies`. Never assert "it is not a peer" from a plain name grep or from hit counts; a peer requirement looks identical to any other mention. Run the scan and quote its result:

   ```bash
   awk '
   /^  [^ ]/ { pkg=$0; inpeer=0 }
   /^    peerDependencies:/ { inpeer=1; next }
   /^    [^ ]/ { if ($1 != "peerDependencies:") inpeer=0 }
   inpeer && /<dep-name>/ { print pkg " -> " $0 }
   ' common/config/rush/pnpm-lock.yaml
   ```

   Empty output means no package in the graph requires it as a peer. Any hit means it is required even without imports — **keep it** and report why.

   Then confirm how the dependency is actually reached, by reading its entry in the `snapshots` section:

   - Listed under another package's `dependencies:` — that package resolves its own copy. Independent of this audit.
   - Named in the parenthesised suffix of a resolved key (e.g. `source-map-loader@5.0.0(webpack@5.108.4)`) — that is a peer link.

3. **Blast-radius check (never the verdict)** — a dependency can be unused here and still legitimately declared elsewhere, so establish who else is involved before removing:

   ```bash
   grep -n "<dep-name>" common/config/rush/pnpm-lock.yaml
   ```

   - Other `importers` entries mean other packages declare it independently. Removing it here does **not** affect them; audit those packages separately.
   - Hits in other packages' `.rush/temp/shrinkwrap-deps.json` do **not** by themselves mean those packages receive it through the package under audit. **Trace the actual path before claiming one.** Read each such package's `package.json` and check whether it declares some *other* dependency that pulls the target in — a sibling `@itwin/*` package is the usual culprit. Only when no other path exists does removal here affect them; then check whether they import it without declaring it, which is an undeclared dependency they must now declare.
   - Attributing a transitive hit to the audited package without tracing it produces a wrong blast-radius claim even when the remove/keep verdict is right.

4. **History check (optional — ask first)** — this is archaeology, not evidence. Checks 1–3 already decide the verdict; history only adds a "when and why" narrative. `git log -S` across all branches is slow on a repo this size, so **ask the user whether they want it** before running it rather than doing it automatically:

   > I've confirmed `<dep-name>` is unused in `<package>`. Want me to also trace the commit that orphaned it? It takes an extra minute but explains why it is still declared.

   If the user says yes:

   ```bash
   git --no-pager log --oneline --all -S'<dep-name>' -- '<package>/src/**'
   git --no-pager log --oneline -S'"<dep-name>"' -- <package>/package.json
   ```

   Scope the first search to the package under audit. Widening it to the whole repo surfaces unrelated packages' usage and will make a genuinely dead dependency look alive.

   A dependency whose last usage in this package was deleted in a commit that never touched this package's `package.json` is a confirmed leftover. Inspect that commit with `git show --stat` to name the removed feature.

## Step 5 — Check for deprecation

Check the **resolved** version from `pnpm-lock.yaml` (not the semver range) plus the current `latest`. Passing a semver range to `npm view` returns every matching version and is useless — always use exact versions or bare names.

Loop over direct deps only:

```bash
for p in <dep> <dep> <dep>; do
  echo "$p latest=$(npm view $p version) deprecated=$(npm view $p deprecated)"
done
```

An empty `deprecated=` means not deprecated. Report separately:

- **Deprecated** — the registry carries a deprecation message. Must be addressed.
- **Behind a major version** — not deprecated, but worth noting. Check whether the lag is intentional before proposing a bump; this repo intentionally pins some packages (for example `chai` 4 and `@types/chai` 4, because chai 5+ is ESM-only). A repo-wide constraint is not a per-package finding.

Prefer a short, reviewable loop over a large generated script.

## Step 6 — Report

Present a table of every direct dependency with declared range, resolved version, latest version, and verdict. Separate confirmed findings from informational notes. For each dependency proposed for removal, state the reverse peer scan result from Step 4 check 2 explicitly, and describe the blast radius only in terms of paths you actually traced. If the optional history check from Step 4 was run, cite the commit that orphaned each unused dependency.

## Step 7 — Removal (only when asked)

Removing a dependency is a real change with consumer impact, because downstream apps may have been relying on hoisting.

1. Edit the package's `package.json` to drop the confirmed entries.
2. Run the Rush update flow from the repo root — never `npm install`, `pnpm install`, or a hand edit of `pnpm-lock.yaml`:

   ```bash
   rush update
   ```

3. Run `rush check` for dependency-version consistency.
4. Build and test the affected package. Prefer the targeted package build over a full `rush build` unless the API surface changed.
5. Commit the regenerated `common/config/rush/pnpm-lock.yaml` and any changed `.rush/temp/shrinkwrap-deps.json` files alongside the manifest edit.

**Do not run `rush change` yourself.** It is an interactive prompt and the CLI handles those poorly. Stop and remind the user instead:

> A Rush change file is still needed for this published package. Please run:
>
> ```bash
> rush change
> ```
>
> This repo uses `"type": "none"`. Describe the concrete user-facing effect rather than a vague label.

Also flag these for the user, since they need human judgement in the change file:

- If a runtime `dependencies` entry was removed, say that it is no longer installed transitively, so consumers that relied on hoisting must declare it themselves.
- Name any package identified in Step 4 check 3 as receiving the dependency only through this one — and only when you traced that path and ruled out every other declared route — so the user can decide whether it needs its own declaration.
