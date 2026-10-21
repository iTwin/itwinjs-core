---
name: api-promotion
description: Promote iTwin.js APIs along the release-tag ladder (alpha -> beta -> public, public+preview -> public) without demoting anything, with accurate user-facing docs and test coverage for every promoted API. Use when asked to mark, move, promote, or stabilize an API as beta or public, or to remove @preview.
---

# API Promotion

Use this skill when changing the release tag of an exported API or one of its members to a more stable level.

Source of truth: `docs/learning/guidelines/release-tags-guidelines.md` and `docs/learning/api-support-policies.md`. Read them when a case is not covered here.

## The promotion ladder

Allowed moves, one direction only:

| From | To |
| --- | --- |
| `@internal` | `@alpha`, `@beta`, or `@public` (when intentionally exposing it) |
| `@alpha` | `@beta` or `@public` |
| `@beta` | `@public` |
| `@public` + `@preview` | `@public` |

Rules:

- **Never demote.** Do not move `@public` to `@beta`/`@alpha`/`@internal`, `@beta` to `@alpha`, or add `@preview` to an existing `@public` API. Demoting a `@public` API is a breaking change and must go through the deprecation policy instead.
- The only exception is an explicit user request to hide a **non-public** API (for example `@alpha` -> `@internal`). Confirm it was never `@public`, keep existing in-repo callers working, and record it in the change file.
- Promote only what was asked. Do not widen the scope to sibling members.

## Release-tag mechanics (API Extractor)

- A member inherits its container's tag. A member may be **less** stable than its container, never more. To promote a member, promote its container first.
- When you promote a container, add an explicit tag to every member that should stay less stable so it does not silently inherit the new tag. This preserves its level; it is not a demotion.
- A promoted signature must not reference a less-stable type (`ae-incompatible-release-tags`). See [Exposed types must be at the same or a more stable level](#exposed-types-must-be-at-the-same-or-a-more-stable-level).
- A promoted member should be reachable through a supported path. If its only accessor (for example a property returning the class) is `@internal`, promote it or call out the gap.
- `private` implementation members need no release tag. Do not add `@internal`, `@beta`, or `@public` to `private` members.
- Put the release tag on its own line at the end of the doc comment, after the description and block tags such as `@param` and `@returns`.

### Exposed types must be at the same or a more stable level

An API may only expose types that are at its own release level or more stable. "Exposed" covers parameter, return, property, generic constraint, base class/interface, and callback signature types, including types nested inside object-literal or function-type parameters.

| API level | May expose |
| --- | --- |
| `@public` | `@public` only |
| `@beta` | `@beta` or `@public` |
| `@alpha` | `@alpha`, `@beta`, or `@public` |
| `@internal` | anything |

Treat the following as `@internal` for this rule, even without a tag:

- Types declared under `src/internal/` or not exported from the package barrel (`src/<package>.ts`).
- Types reachable only through `src/internal/cross-package.ts`.

API Extractor does **not** catch every violation. It misses cross-package references and types that are not exported at all. Check each exposed type yourself:

1. Find each type's declaration and release tag. For a cross-package type, check the `common/api/<other-package>.api.md` report or the source.
2. Confirm the type is exported from its package barrel and not only from `internal/`.
3. Repeat for the members of each exposed class or interface. Their signatures are exposed too.

When an exposed type is less stable than the API, either:

- Promote the type in the same change, moving it out of `src/internal/` if necessary. This widens the API surface; confirm it with the user first.
- Or keep the API at the level of its least stable exposed type. If that means hiding a non-public API (for example `@alpha` -> `@internal` because it exposes internal types), confirm with the user and record the reason in the change file.

Example: `RebaseManager.addConflictHandler` takes a handler typed with `RebaseChangesetConflictArgs` (declared in `src/internal/`, not exported) and `DbConflictResolution` (`@internal` in core-bentley). It therefore cannot be `@alpha`, `@beta`, or `@public` until those types are promoted, so it was marked `@internal`.

## Documentation requirements

`@beta` and `@public` APIs are published on itwinjs.org. Every promoted API, its promoted members, and promoted referenced types must have user-facing docs that are **present, accurate, and correctly linked**.

For each promoted symbol, read the implementation and its callers, then verify:

- **Behavior matches the code.** Check error paths, defaults, ordering, side effects, events raised, and state left behind on failure. Use tests as evidence for failure behavior.
- **Terminology is correct.** Name the owning concept (for example "pull/merge" vs. "transaction", "rebase manager" vs. "transaction manager").
- **Preconditions are stated.** Note when the API throws, returns `undefined`, or is a no-op.
- **Links resolve to supported APIs.**
  - Use `[[Class.member]]` (or `{@link}`) instead of backticked names for real symbols.
  - Do not reference `@internal` or `@alpha` symbols from `@beta`/`@public` docs.
  - Do not reference deprecated APIs; link the replacement.
  - Do not use bare `[[member]]`; qualify it with the owning type.
- **TSDoc, not JSDoc.** Use `@param`, `@returns`, `@throws`, `@remarks`, `@see`. Do not use `@yields`, `@property`, or `{Type}` annotations. Document interface fields with their own `/** */` comments so the API report does not mark them `(undocumented)`.
- **No release-tag meta text** in descriptions (for example "this member is beta, the constructor is alpha"). The tags already convey this.
- **No implementation narration** (for example "iterates the internal linked list"). Describe the contract.

## Test requirements

Every promoted API must be exercised by a test that asserts its behavior, not only that it was called.

1. Search the package tests for each promoted symbol (for example `grep -rn "symbolName" <package>/src/test`).
2. If a test exercises the documented behavior, including important failure cases, record it as evidence.
3. If coverage is missing, add the smallest targeted test in the existing test file for that area, following the package's test runner and conventions. Do not commit `.only`.
4. Run the targeted tests and report the exact command and result. If a test cannot run locally (for example it needs hub access or native assets), state the command and the blocker.

## Workflow

1. List the requested symbols and their current tags from source and `common/api/<package>.api.md`.
2. Check the ladder. Stop and ask before any move that is not an allowed promotion.
3. Find containers, referenced types, and accessors that must be promoted too, and members that need explicit tags to stay at their current level.
4. Update tags in source.
5. Review and fix docs on everything promoted.
6. Verify or add tests.
7. Build and extract API reports from the package directory: `rushx build`, then `rushx extract-api` (it reads `lib/cjs`). Build dependency packages first when their tags changed, for example `core-common` before `core-backend`.
8. Review the diff of `common/api/<package>.api.md` and `common/api/summary/<package>.exports.csv`. Every tag change should move up the ladder; any added lower tag must only preserve a member's previous level.
9. Lint with `rushx lint` in each affected package.
10. Add a Rush change file per affected published package (`rush change`, `"type": "none"`) naming the promoted APIs.
11. Add `docs/changehistory/NextVersion.md` notes only for promotions to `@public` or significant user-visible features, following the repo's NextVersion rules.

## Final check

- [ ] No API moved down the ladder, except an explicitly requested hide of a non-public API.
- [ ] Every promoted API exposes only types at its own level or more stable, including cross-package and unexported types that API Extractor does not flag.
- [ ] Members meant to stay less stable have explicit tags.
- [ ] Every promoted symbol has accurate TSDoc with resolvable links to supported APIs.
- [ ] Every promoted symbol has a behavior test, with run results reported.
- [ ] API reports regenerated and reviewed; change files added.
