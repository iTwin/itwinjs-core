---
name: api-promotion
description: Promote iTwin.js APIs to beta or public, or remove @preview, following repository release-tag policy.
---

# API Promotion

## Workflow

### 1. Read policy and establish scope

Read `docs/learning/guidelines/release-tags-guidelines.md` and `docs/learning/api-support-policies.md` first. Use those documents to choose release tags and interpret `@preview`; this skill does not define a separate promotion ladder.

List the requested symbols, their effective current tags (including inherited tags), and target tags using source and `common/api/<package>.api.md`. If the target or readiness for public support is unclear, confirm it with the user before editing.

### 2. Check promotion dependencies

- Check whether a containing API also needs promotion. When promoting a container, preserve the effective tags of members outside the requested scope with explicit member tags where needed; private implementation members need no tags.
- Check that consumers can obtain and use the API through supported exports and, where applicable, constructors, factories, or accessors.
- Use API Extractor's `ae-incompatible-release-tags` errors to guide same-package signature checks instead of recursively inspecting every referenced class and member.
- Manually check cross-package types exposed by the promoted signatures against their source or API reports. Also check for unexported types and types accessible only through `src/internal/` or `internal/cross-package.ts`; `ae-forgotten-export` is suppressed in `tools/build/scripts/extract-api.js`. Include types nested in callbacks, generic constraints, and base types.

If a dependency requires promoting additional APIs or changing exports, explain the blocker and confirm the expanded scope before making those changes.

### 3. Update tags and documentation

Apply the agreed tags using the policy's placement rules. Review the promoted APIs' documentation against implementation, callers, and tests:

- Describe the consumer contract, including relevant preconditions, defaults, errors, side effects, and failure behavior, rather than implementation details.
- Use accurate terminology and TSDoc, including documentation on interface fields.
- Ensure links resolve to documented, supported APIs; qualify member links with their owning type. Avoid repeating release-tag metadata in prose.

### 4. Verify coverage

Find existing tests for the promoted contract, including important failure cases. Reuse sufficient coverage; add focused tests only for gaps, following the package's conventions. Runtime tests should assert behavior, not just invocation. For interfaces and type aliases, verify appropriate compiled usage or type-level coverage rather than inventing a runtime test for each declaration.

Read the affected package's `package.json` for its build and test commands. Build before running tests that consume compiled output. Record the targeted test commands and results, or the exact blockers if they cannot run.

### 5. Regenerate and review reports

During iteration, use the affected packages' build and `extract-api` scripts, rebuilding changed dependencies first. Resolve diagnostics and review `common/api/<package>.api.md` and `common/api/summary/<package>.exports.csv` for the agreed promotions, preserved member tags, and unintended API changes.

Follow `CONTRIBUTING.md` for required validation and pre-push checks; package-local iteration does not replace its clean repository build and API extraction requirement for release-tag changes. Include affected-package lint and documentation builds where required.

### 6. Record the change

Follow `CONTRIBUTING.md` for Rush change files in affected published packages (`"type": "none"`), naming the promoted APIs. Add `docs/changehistory/NextVersion.md` guidance for breaking changes or significant features, following the repository's NextVersion rules.
