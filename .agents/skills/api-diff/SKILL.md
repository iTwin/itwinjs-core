---
name: api-diff
description: Compare public API changes between two branches or version tags in the iTwin.js Rush monorepo by diffing the extract-api generated `common/api/*.api.md` files. Categorizes additions, removals, deprecations, tag changes, and highlights potential breaking changes. Use when the user asks to review or compare API differences between versions, branches, or releases (e.g. "diff 5.9 vs 5.10", "what changed between release/5.9.0 and release/5.10.0", "review API changes", "what's new in master", "check NextVersion.md coverage").
---

# API Diff Skill

Compares `common/api/*.api.md` files between two git refs to surface API changes in the iTwin.js monorepo.

## Quick start

```bash
# Branch names follow the pattern: release/MAJOR.MINOR.0
.agents/skills/api-diff/scripts/api-diff.sh release/5.9.0 release/5.10.0   # adjacent releases
.agents/skills/api-diff/scripts/api-diff.sh release/4.11.0 release/5.10.0  # multi-minor span
.agents/skills/api-diff/scripts/api-diff.sh release/5.10.0 master          # last release → master

# Find the last release tag automatically
LAST=$(git tag --sort=-version:refname | head -1)
.agents/skills/api-diff/scripts/api-diff.sh "$LAST" master
```

## Identifying the right refs

| Goal | Base ref | Head ref | Changelog to check |
|---|---|---|---|
| What's new in an upcoming release | latest `release/X.Y.0` branch | `master` | `docs/changehistory/NextVersion.md` |
| What changed between two releases | `release/X.Y.0` | `release/X.Z.0` | All `docs/changehistory/{version}.md` in range |
| Multi-minor span | `release/X.Y.0` | `release/A.B.0` | Script shows all changelogs automatically |

## Workflow

1. **Identify the refs** — see table above. Branch names follow `release/MAJOR.MINOR.0`. For unreleased work use `release/<latest>.0` → `master`.
2. **Run the diff** — use the helper script or `git diff <base> <head> -- common/api/` directly.
3. **Triage each changed package** — apply the categories below.
4. **Highlight breaking changes** — surface them first in the summary.
5. **Check changelog coverage** — for `master` diffs check `NextVersion.md`; for release diffs check `{version}.md`.
6. **Present structured output** — one section per package, then a consolidated breaking-changes table.

## Categorizing changes

| Category | How to detect | Risk |
|---|---|---|
| **Breaking — removal** | `-export` or `-    methodName` on a `@public`/`@public @preview` symbol | 🔴 High |
| **Breaking — signature** | `-` and `+` lines for same `@public` method, type changed | 🔴 High |
| **Non-breaking — signature** | Optional parameter added, return type widened | 🟡 Low |
| **Deprecation** | `+    // @deprecated` added to an existing member | 🟡 Planned removal |
| **Tag promotion** | e.g. `-// @beta` / `+// @public` | 🟢 Additive |
| **New addition** | `+export` on a new symbol | 🟢 Additive |
| **Internal-only change** | Change only on `@internal` / `@alpha` / `@beta` symbols | ✅ Safe |

> See [REFERENCE.md](REFERENCE.md) for full support policy, promotion paths, deprecation rules, and what counts as a breaking change.

## Breaking change checklist

- [ ] Is the symbol `@public` or `@public @preview`? (`@internal`, `@alpha`, `@beta` are safe to change)
- [ ] Is the change structurally incompatible? (adding optional params is non-breaking per policy)
- [ ] Callback type narrowed to a named alias? Check structural equivalence before flagging

## Output format

```
## API Diff: <base> → <head>

### ⚠️ Potential Breaking Changes
| Package | Symbol | Change | Risk |

### Changes by package
#### <package-name>
**Additions** (`@public`/`@beta`): ...
**Deprecations**: ...
**Tag promotions**: ...
**Removals**: ...

### Changelog gaps
Items with no entry in docs/changehistory/NextVersion.md (or {version}.md): ...
```

## Running the tests

```bash
.agents/skills/api-diff/scripts/test-api-diff.sh
```

Tests cover `ref_to_minor_ver` parsing, Python changelog version filtering (boundary conditions, numeric sorting), and a smoke test of the full script. Run after any changes to the script.

## Tips

- Ignore `common/api/summary/*.exports.csv` — generated metadata only.
- All packages use **lockstep versioning** — one version number for all packages.
- `@public @preview` ≠ `@beta`. Preview APIs are production-ready but may change in the next major version (3-month removal grace period vs 1-year for plain `@public`).
- Missing release tags (`// (undocumented)`) are treated as `@internal`.
- `git diff release/5.9.0 release/5.10.0 -- common/api/core-backend.api.md | grep "^[+-]" | grep -v "^[+-][+-]"` for a quick per-file scan.
