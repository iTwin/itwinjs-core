---
name: test-suite-refactoring
description: Split large, state-sharing backend test monoliths into isolated per-area files using the hybrid isolation model, with performance baselining and iTwin.js-specific gotchas.
---

# Test Suite Refactoring in iTwin.js

Use this skill when a test file has grown into a monolith whose tests share and mutate the same iModels, creating ordering dependencies. It covers how to split it safely, how to prove you did not regress runtime, and the repo-specific traps that waste the most time.

## When this applies

Look for these smells:

- A single `describe` with dozens of tests and a handful of `let imodel1..imodelN` declared at suite scope
- iModels opened once in `before` and mutated by individual tests
- Tests that only pass in declaration order, or fail when run with `.only`
- Cleanup that closes iModels in `after` but leaks them if a test throws midway

## The hybrid isolation model

Do not give every test its own copy — that is correct but slow. Do not share one mutable iModel — that is fast but fragile. Split by **whether the test mutates**:

| Test kind | Fixture                              | Lifetime                                              |
| --------- | ------------------------------------ | ----------------------------------------------------- |
| Read-only | One shared read-only handle per file | Opened in `before`, closed in `after`                 |
| Mutating  | Its own fresh writable copy          | Created in the test, closed by tracker in `afterEach` |

A read-only handle is safe to share precisely because nothing can mutate it. This keeps the common case cheap while making mutation leaks impossible.

### Building a read-only fixture

There is no "open a seed read-only" primitive that also isolates you — opening the seed asset directly shares the real repo asset across the whole run. Instead: copy, close, reopen read-only.

```ts
// in before()
testBimReadonly = await openReadonlySeedCopy("elements-test.bim", "test.bim", {
  importTestBim: true,
});
compatibilityReadonly = await openReadonlySeedCopy(
  "elements-CompatibilityTestSeed.bim",
  "CompatibilityTestSeed.bim",
);
```

### Tracking mutable iModels

Every writable copy goes through the tracker so teardown is guaranteed even when a test throws.

```ts
const { trackMutableIModel, closeTrackedIModels } =
  createMutableIModelTracker();

afterEach(() => closeTrackedIModels()); // idempotent — safe to also call from after()

it("should insert a DisplayStyle", () => {
  const imodel = trackMutableIModel(
    createIModelFromSeed(
      "views-insert-display-style.bim",
      "CompatibilityTestSeed.bim",
    ),
  );
  // ...
});
```

Type the tracker to `IModelDb`, not `SnapshotDb`, so it also accepts `StandaloneDb` and `BriefcaseDb`. `SnapshotDb` and `StandaloneDb` are **siblings** (`StandaloneDb extends BriefcaseDb extends IModelDb`), so a helper typed to `SnapshotDb` silently excludes standalone tests.

## Keep canonical helpers in exactly one place

Every shared fixture helper belongs in a single `itwinjs-core\core\backend\src\test\imodel\IModelTestFixtures.ts` next to the tests. Reviewers on this repo push back hard on duplication here — the same boilerplate appearing in 4-6 files defeats the point of having the module.

Helpers proven useful in the reference refactor:

| Helper                                      | Purpose                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `createIModelFromSeed(target, seed)`        | The single **sync** creation path for a writable copy                                |
| `importTestBim(db)`                         | Composable **async** schema import: `await importTestBim(createIModelFromSeed(...))` |
| `openReadonlySeedCopy(target, seed, opts?)` | Canonical shared read-only fixture (copy, close, reopen)                             |
| `closeIfOpen(...dbs)`                       | Teardown guarding `undefined` and already-closed handles                             |
| `createMutableIModelTracker()`              | Returns `{ trackMutableIModel, closeTrackedIModels }`                                |

Two design rules that came directly out of review:

- **Prefer composition over a boolean flag** when the variants differ by an async step. Merging a sync creator and an async creator behind `{ importTestBim?: boolean }` forces _every_ call site async, including the many that are genuinely synchronous. A separate `importTestBim(db)` keeps sync tests sync and makes the schema import visible at the call site.
- **Name helpers so the mechanism is obvious.** `track` → `trackMutableIModel`, `closeTracked` → `closeTrackedIModels`. These names appear at dozens of call sites and are the main thing a newcomer reads.

Before adding a helper, check it is actually reachable. An exported-but-uncalled helper is dead code that reviewers will flag, and deleting it is usually right — but confirm the intended caller is not simply using a subtly different behavior (for example, sharing the seed asset directly versus an isolated copy).

## Error helpers must not swallow

A helper that converts a rejection into a value must rethrow anything unexpected, or a real bug reports as a useless assertion message.

```ts
export async function getIModelError<T>(
  promise: Promise<T>,
): Promise<IModelError | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    if (err instanceof IModelError) return err;
    throw err; // a TypeError here is a real bug — keep its message and stack
  }
}
```

Returning `undefined` for both "resolved" and "threw the wrong type" collapses two very different failures into `expected undefined to not be undefined`. After the rethrow, `undefined` means exactly one thing, and the paired assertion can report the resolved case precisely.

## Determinism

Replace `Math.random()` selection with a deterministic stride so failures reproduce. But check what the randomness was incidentally covering first — sampling _with replacement_ passes duplicate entries, which may be the only coverage of duplicate-input handling. Preserve that intentionally rather than dropping it: keep the deterministic subset and add a deliberate duplicate entry.

Rename the test once selection is deterministic; leaving "random" in the name is misleading.

## Naming and file layout

- One file per feature area: `IModel<Area>.test.ts` (PascalCase, no dots) — for example `IModelElements.test.ts`, `IModelViews.test.ts`
- Shared fixtures: `IModelTestFixtures.ts` in the same folder
- Only prefix files that are genuinely facets of the split suite. Independent subjects already in the folder (`Code.test.ts`, `ProjectExtents.test.ts`) should **not** be renamed to match.

## Baseline performance before you start

Splitting a suite multiplies iModel copies, so measure first or you cannot defend the result.

```powershell
# from core/backend — run 3x before and 3x after
rushx test "lib/cjs/test/imodel/IModel*.test.js" --no-config --require source-map-support/register `
  --timeout 999999 --reporter json --reporter-option output=baseline-run-1.json
```

Write the JSON with `--reporter-option output=<file>`, **not** `1> file.json`. `rushx` prints its own banner (`Rush Multi-Project Build Tool ...`, the echoed command) to stdout, so redirecting stdout produces a file that is not valid JSON.

Read `stats.duration` from each run and compare medians. Expect a modest increase from added isolation; treat more than 20% as needing justification. The reference refactor landed at roughly +10% (20.2s to 22.2s) for 80 tests.

## Verification loop

```powershell
# from core/backend
rushx lint          # lints all of ./src/**/*.ts — rushx lint-fix to auto-fix
rushx build:cjs     # tsc --outDir lib/cjs
rushx test "lib/cjs/test/imodel/IModel*.test.js" --no-config --require source-map-support/register --timeout 999999
```

Confirm the **test count is unchanged** after a pure split. A drop means a test was lost in the move.

## Gotchas that cost the most time

- **`rushx` only runs `package.json` scripts, not arbitrary binaries.** `rushx eslint ...` fails with _"the command is not defined in the package.json file for this project"_. It does forward extra arguments to the underlying script, which is why `rushx test <spec> --reporter json` works — it becomes `mocha <spec> --reporter json`. There is no script that lints a subset, so `rushx lint` always covers the whole package.
- **Tests run against compiled output.** Mocha runs `lib/cjs/test/...`, not `src`. Always build before running or you are testing stale code.
- **Run mocha sequentially.** Parallel runs contend on the backend profile lock.
- **`tsc` emits on type errors by default.** Tests can pass while the build reports errors, which masks stale-dependency problems. Do not treat a green test run as proof the build is clean.
- **Native addon drift produces nonsense failures.** A stale `@bentley/imodeljs-native` surfaces as an assertion failure such as `expected undefined to equal 2` — not a dependency error — because the older BisCore schema lacks a property the test expects. When a newly merged test fails inexplicably, compare `core/backend/package.json` against what is installed, then `rush update` and `rush build --to @itwin/core-backend`.
- **Do not call `shutdownBackend()` in a per-file `after`.** `TestUtils` starts the backend once globally; tearing it down per file is a large regression. Only restart when a file genuinely needs different startup options (such as `loadGcsWorkspaces: true`), and restore the default afterwards.
- **`cspell` is editor-only here** (`.vscode/cSpell.json`), not part of lint or CI, so `// spell-checker: disable` directives in test files are noise.

## Change management

A pure test refactor touches no shipped API, so it needs **no** `rush extract-api`. However, `rush change` is still required. For pure testing related PRs, the change comment should be left blank. If the refactor pulls in a dependency manifest change (such as a native addon bump arriving via merge), that does require the Rush update flow and a regenerated lock file.

## Related skills

- `merge-conflict-resolving` — handling the modify/delete conflicts that recur while a long-lived refactor branch tracks master
- `pr-review-considerations` — the review heuristics this repo applies to such PRs
