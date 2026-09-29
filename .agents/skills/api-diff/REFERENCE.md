# API Support Policy Reference

Source: [api-support-policies.md](https://github.com/iTwin/itwinjs-core/blob/master/docs/learning/api-support-policies.md)

## Release tags

| Tag | Meaning | Breaking change policy |
|---|---|---|
| `@internal` | iTwin.js internals only, never for consumers | None — may change freely |
| `@alpha` | Highly experimental, rare in this repo | None |
| `@beta` | Under development, feedback welcome | May break at any time |
| `@public` | Stable, production-ready | Only in major releases, after deprecation + 1-year grace period |
| `@public @preview` | Production-ready **but** may change/be removed in the **next major version** | 3-month grace period before removal |

`@preview` is **not** a synonym for `@beta`. It is used alongside `@public` to indicate an API that is production-ready within the current major version but not guaranteed across major versions.

Missing release tags (`// (undocumented)`) are treated as `@internal`.

## Promotion paths

```
@alpha  →  @beta  →  @public               (standard)
                  ↘  @public @preview  →  @public   (intermediate: stable but not yet committed)
```

`@public @preview` is used when an API is ready for production use but the team wants to reserve the right to revise it before locking it in as fully `@public`.

## Deprecation policy

- **`@public` APIs**: must be `@deprecated` first with a removal date note; **1-year grace period** before removal in a major release.
- **`@public @preview` APIs**: same but **3-month grace period**.
- **`@beta` APIs**: no deprecation required; may be removed at any time.

Deprecation note format (pipeline auto-adds date — do not add manually):
```typescript
/** @deprecated in 5.1 - will not be removed until after 2026-01-01. Use methodB instead. */
```

## What counts as a breaking change

Per the support policy:

**Interfaces**
- Removing a property
- Adding a new **required** property
- Changing the type of a property
- Adding an optional property likely to conflict with existing usage

**Classes** (excluding `private`)
- Removing a property or method
- Adding a new required abstract property/method
- Adding a property/method with a name likely to conflict with subclasses
- Changing visibility or type of a property

**Functions and methods**
- Changing the signature (parameters and/or return type)
  - ✅ Exception: appending new arguments **with default values**
  - ✅ Exception: changing return type from `void` to something else

**Enums and tagged unions**
- Removing values
- Adding new values (unless exhaustive testing is unlikely)

## Changelog locations

| Situation | File |
|---|---|
| Unreleased / in-progress work | `docs/changehistory/NextVersion.md` |
| Released version | `docs/changehistory/{version}.md` (e.g. `5.10.0.md`) |

Notable changes that must be documented:
- New `@public` or `@beta` APIs
- Any deprecation (with migration guidance)
- Behavior changes (even without API signature change)
- Breaking changes (with before/after code examples)
