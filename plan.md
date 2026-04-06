# Plan: Solve Issue #1927 — Integrate Settings Example Code into Documentation

## Problem

`docs/learning/backend/Workspace.md` has documentation gaps identified in #1898 and #1920:

1. **`saveSettingDictionary` vs `addDictionary`** — the distinction (persistent vs session-only) is implied but never called out explicitly in docs or JSDoc
2. **iTwin/org-scoped settings workflows** — priority values are listed but no examples for higher scopes
3. **Settings schema validation behavior** — no guidance on what happens when values don't match schemas
4. Additionally, neither API's JSDoc cross-references the other

## Current State

- **Extracts live in `example-code/snippets/src/backend/WorkspaceExamples.test.ts`** (459 lines) — not yet migrated to `core/backend/src/test/example-code/` (that's issue #1926, separate PR in progress)
- **Workspace.md** already uses 14 `[[include:...]]` references, all pointing to `WorkspaceExamples.*` extracts
- **Unused extracts exist**: `Settings.addDictionaryDefine`, `Settings.addDictionary`, `Settings.addITwinDictionary`, `Settings.dropITwinDictionary` — these are in the test file but not referenced from Workspace.md
- **`addDictionary` JSDoc** (Settings.ts:242-246): no mention of session-only behavior, no `@see` to `saveSettingDictionary`
- **`saveSettingDictionary` JSDoc** (IModelDb.ts:2162-2168): has `@note` about persistence, but no `@see` to `addDictionary`
- **`validateSetting`** is a no-op if no schema is registered (SettingsSchemasImpl.ts:44-47)

## Approach

Work in the worktree at `~/Documents/itwinjs-settings-workspace-docs` on branch `nam/settings-workspace-docs`. Since the snippet migration (issue #1926) is in progress separately, we'll add new extracts in `example-code/snippets/src/backend/WorkspaceExamples.test.ts` for now (same file where existing extracts live) and update `Workspace.md` to reference them. The migration PR will move them later.

## Todos

### 1. `doc-save-vs-add` — Document `saveSettingDictionary` vs `addDictionary` distinction

**Files:**
- `docs/learning/backend/Workspace.md` — add a new subsection under `## iModel settings` (after line ~118) or as a standalone callout section titled "Persisted vs session-only dictionaries"

**What to write:**
- Explicit side-by-side table: `addDictionary` = in-memory/session-only, `saveSettingDictionary` = persisted to `be_Props`
- Note that `addDictionary` values are lost when the iModel closes; `saveSettingDictionary` values auto-load on every future open
- Reference existing extracts: `WorkspaceExamples.AddDictionary` (for `addDictionary`) and `WorkspaceExamples.saveSettingDictionary` (for `saveSettingDictionary`) — both already exist
- Add a note questioning whether this split is intentional design or a legacy artifact

**No new extract needed** — the existing extracts already demonstrate both APIs. We just need prose to connect them.

### 2. `jsdoc-cross-references` — Add JSDoc cross-references to both methods

**Files:**
- `core/backend/src/workspace/Settings.ts` (line ~246, `addDictionary`)
  - Add: `@note Values added via this method exist only for the current session. They are not persisted and will be lost when the iModel is closed. To persist settings across sessions, use [[IModelDb.saveSettingDictionary]].`
- `core/backend/src/IModelDb.ts` (line ~2162, `saveSettingDictionary`)
  - Add: `@see [[Settings.addDictionary]] to register a dictionary for the current session only without persisting it.`

### 3. `doc-priority-hierarchy` — Document iTwin/org-scoped priority model

**Files:**
- `docs/learning/backend/Workspace.md` — expand the `### Settings priorities` section (line ~99)

**What to write:**
- The existing bullet list of priority values is fine, but add a paragraph explaining the practical workflow: how an org admin would set org-level defaults that iTwin-level settings override, etc.
- Reference the unused extracts `Settings.addITwinDictionary` and `Settings.dropITwinDictionary` — add `[[include:...]]` blocks to show how to add/drop dictionaries at iTwin priority
- Add a callout noting that full iTwin/org-scoped examples (loading from cloud containers) depend on the Container Discovery API (#1920 section 1), which is deferred

**New extract needed?** No — `Settings.addITwinDictionary` and `Settings.dropITwinDictionary` already exist but are just unreferenced. Wire them into the doc.

### 4. `doc-schema-validation` — Document settings schema validation behavior

**Files:**
- `docs/learning/backend/Workspace.md` — add a subsection under `## Settings schemas` (after the "Registering schemas" subsection, line ~63)

**What to write:**
- Explain that validation happens lazily on retrieval (`getObject`, `getString`, etc.), not on storage
- If no schema is registered for a setting name, `validateSetting` is a no-op — the value passes through unchecked
- If a schema IS registered: type mismatches throw, `required` fields are enforced, `extends` expands typeDefs recursively
- Brief example or note referencing the existing `WorkspaceExamples.RegisterSchema` extract

**New extract needed?** Possibly a small one showing a validation failure (try to `getObject` with a bad value and catch the error). Add to `WorkspaceExamples.test.ts` as `WorkspaceExamples.ValidationFailure`.

### 5. `doc-dictionary-structure` — Document settings dictionary structure recommendations

**Files:**
- `docs/learning/backend/Workspace.md` — add a subsection under `## Settings dictionaries` (after line ~67)

**What to write:**
- Naming conventions: use schema prefix + forward-slash grouping (already partially covered but not called out as a recommendation)
- Nesting: prefer flat keys with `/` grouping over deeply nested objects
- Reference the existing schema extract for type constraints

**No new extract needed** — this is prose guidance referencing existing patterns.

### 6. `verify-includes` — Verify all `[[include:...]]` references resolve

**Steps:**
- After all edits, run `rushx docs` in `example-code/snippets` to verify extract generation
- Grep `Workspace.md` for `[[include:...]]` and confirm each tag has a corresponding `__PUBLISH_EXTRACT_START__` in the test file
- Run `rushx build` and `rushx test` in `example-code/snippets` to make sure the test still passes

## Dependencies

```
1. doc-save-vs-add       (no deps)
2. jsdoc-cross-references (no deps)
3. doc-priority-hierarchy (no deps)
4. doc-schema-validation  (no deps)
5. doc-dictionary-structure (no deps)
6. verify-includes        (depends on 1, 2, 3, 4, 5)
```

All content todos (1-5) are independent and can be done in parallel. Todo 6 is verification after all edits are complete.

## Open Questions

- **Snippet location**: New extracts go in `example-code/snippets/...` since the migration to `core/backend` (issue #1926) is a separate in-progress PR. Should we coordinate with that PR, or just work here and let the migration move things later?
- **Validation failure extract**: Is a test showing a validation error worth adding, or is prose description sufficient?
