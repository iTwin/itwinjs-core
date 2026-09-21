# Synchronous Text-Field Quantity Formatting

## Status

Working implementation specification for the synchronous formatting path used by backend text-field evaluation.

## Goal

Define the two-PR API path that lets a later text-fields integration construct or retrieve a `FormatterSpec` without awaiting a provider, while preserving the existing asynchronous quantity APIs for general providers and schema loading.

The first path is intentionally local and cache-ready: it uses the bundled BIS units represented by `BasicUnitsProvider`, constructs `UnitProps` from the existing resolved unit data, and applies the existing synchronous `FormatterSpec` runtime. If required metadata is not available synchronously, the caller formats plain text rather than loading or awaiting it.

## Decisions recorded

- The synchronous path is based on `BasicUnitsProvider` and the bundled canonical BIS unit set.
- The synchronous path intentionally does not support custom units. PR1 supports the bundled canonical BIS units only. PR2 may add cache-only schema metadata methods for an explicit consumer requirement, but it does not make arbitrary custom-unit loading or conversion synchronous; unavailable metadata uses the plain-text fallback.
- Use the existing synchronous `UnitConversions.getConversion()` helper for canonical unit conversions, guarded by `isUnitName()`. Do not add a second built-in conversion algorithm.
- Reuse `buildResolvedBasicUnitsData()` and `ResolvedBasicUnitsData` to construct complete `UnitProps` objects synchronously. Do not add a separate hand-maintained or duplicate `UnitProps` table.
- Preserve the existing asynchronous `UnitsProvider`, `FormatsProvider`, `Format.createFromJSON()`, and `FormatterSpec.create()` contracts. Do not change their return types to `T | Promise<T>` or rely on casts to make an asynchronous method synchronous.
- Add synchronous capability interfaces and entry points rather than making an existing asynchronous method conditionally synchronous.
- `BasicUnitsProvider.findUnitByNameSync()` returns `BadUnit` when the resolved state is unavailable or the name is not known. `getConversionSync()` returns the existing identity conversion with `error: true` for unavailable, unknown, or incompatible units. No separate readiness result type, readiness report, or readiness API is required.
- PR1 must make an explicit packaging choice for `BasicUnitsProvider`: construct the bundled unit indexes synchronously on first use, or preserve the lazy JSON boundary and report unavailable state until the existing async initialization has run. Static or generated bundled data increases startup or bundle cost; first-use construction increases transaction-local CPU cost. Neither option is an asynchronous schema-loading requirement.
- `SyncUnitsProvider` and `SyncFormatsProvider` are additive public `@beta` capabilities in `core/quantity`, because public synchronous formatter factories and later `ecschema-metadata` implementations need a shared cross-package contract.
- The first PR is limited to `core/quantity`. A second, stacked PR may add cache-only synchronous methods to `SchemaFormatsProvider` and `SchemaUnitProvider` if schema metadata access is required; it does not expand the first path to arbitrary custom-unit conversion.
- Format resolution needs a synchronous capability for local `FormatSet` data. A loaded `SchemaFormatsProvider` may participate as a synchronous fallback in the second PR; this does not make schema loading synchronous.
- `findUnit()` by display label and `getUnitsByFamily()` are not required for this workflow. The minimum unit capability is name lookup plus conversion.

## Current facts

### `BasicUnitsProvider` already has the required synchronous construction logic

`core/quantity/src/internal/BasicUnitConversionData.ts` contains `buildResolvedBasicUnitsData(schema)`. The function synchronously resolves the serialized `Units.json` definitions, creates lookup maps, and constructs complete `UnitProps` values containing `name`, `label`, `phenomenon`, `system`, and `isValid`.

The asynchronous part of `BasicUnitsProvider` is currently the lazy `import("./assets/Units.json")` in `resolveState()`. The sync feature should expose synchronous reads from the already-built shared state rather than duplicate the deserialization or conversion data.

### `UnitConversions` already supplies the built-in synchronous conversion

`core/quantity/src/UnitConversions.ts` exposes synchronous `getConversion()` and `isUnitName()` helpers. The sync provider implementation should verify that both `UnitProps.name` values are canonical built-in names, then delegate to `UnitConversions.getConversion()`.

If either name is outside the canonical set, the sync path must not silently treat it as a built-in unit. It returns the defined invalid/miss result and lets the backend raw-value fallback handle the case.

### `Format.createFromJSON()` is asynchronous only at unit-name resolution

`Format.createFromJSON()` calls `resolveFormatProps()`, which awaits `UnitsProvider.findUnitByName()` for composite units and, for azimuth/bearing formats, `azimuthBaseUnit` and `revolutionUnit`. Format validation and `fromFullyResolvedJSON()` are synchronous after those `UnitProps` values exist.

The implementation should extract a synchronous `resolveFormatPropsSync()` that uses the sync unit capability. The smallest public entry point is `Format.createFromJSONSync()`, which can call the existing `fromFullyResolvedJSON()`. An instance `fromJSONSync()` is not required unless a caller needs to populate an existing `Format`; do not add it preemptively.

### `FormatterSpec.create()` is asynchronous only at conversion lookup

`FormatterSpec.create()` awaits `UnitsProvider.getConversion()` while building conversion specs for ordinary composites, ratio formats, and azimuth/bearing auxiliary units. The `FormatterSpec` constructor and `applyFormatting()` are already synchronous.

The implementation should share the existing conversion algorithm and add a synchronous factory, `FormatterSpec.createSync()`, that calls a synchronous conversion capability. The sync implementation must preserve ratio, inverted-unit, azimuth, bearing, warning, and invalid-conversion behavior.

## Proposed capability interfaces

The interfaces belong in `core/quantity` because that package owns `UnitProps`, `UnitConversionProps`, `UnitsProvider`, and the formatting factories.

```ts
export interface SyncUnitsProvider {
  findUnitByNameSync(unitName: string): UnitProps;
  getConversionSync(fromUnit: UnitProps, toUnit: UnitProps): UnitConversionProps;
}

export interface SyncFormatsProvider {
  getFormatSync(formatName: string, unitSystem?: UnitSystemKey): FormatDefinition | undefined;
}
```

These are capabilities, not replacements for the existing asynchronous interfaces. A provider may implement both interfaces, only the asynchronous interface, or only the synchronous capability where appropriate.

## Package work table

| Package | Existing piece | Change | PR |
| --- | --- | --- | --- |
| `core/quantity` | `UnitsProvider` | Add public `@beta` `SyncUnitsProvider` with `findUnitByNameSync()` and `getConversionSync()` | PR1 |
| `core/quantity` | `BasicUnitsProvider` | Expose synchronous reads backed by `ResolvedBasicUnitsData`; delegate canonical conversions to `UnitConversions` | PR1 |
| `core/quantity` | `CompositeUnitsProvider` | Delegate the sync capability when the selected provider supports it; preserve provider precedence | PR1 if needed by the BasicUnitsProvider path |
| `core/quantity` | `Format.createFromJSON()` | Extract shared resolution logic and add `Format.createFromJSONSync()` | PR1 |
| `core/quantity` | `FormatterSpec.create()` | Share conversion logic and add `FormatterSpec.createSync()` | PR1 |
| `core/quantity` | `FormatsProvider` | Add public `@beta` `SyncFormatsProvider` as a separate capability | PR1 |
| `ecschema-metadata` | `FormatSetFormatsProvider` | Implement `getFormatSync()` for local `FormatSet` lookup and sync-capable fallback | PR2 if format-provider integration is needed |
| `ecschema-metadata` | `SchemaFormatsProvider` | Implement `getFormatSync()` only for already-loaded schema data | PR2 if schema-format fallback is needed |
| `ecschema-metadata` | `SchemaUnitProvider` | Add cache-only sync methods only if schema metadata integration requires them; custom-unit conversion remains out of scope | PR2, conditional |
| `core/backend` | `FieldFormattingSpecProvider` | The text-fields integration PR owns whether to use sync construction on a spec-cache miss, how to replace `requirements`/`warmUp`, and when to use the plain-text fallback | Later integration PR |

## Stacked PR plan

### PR1: `core/quantity`

PR1 adds the synchronous quantity primitives without changing `ecschema-metadata`, `core/backend`, or text-fields behavior. It includes the public `@beta` capability interfaces, the synchronous `BasicUnitsProvider` methods, `Format.createFromJSONSync()`, `FormatterSpec.createSync()`, and focused tests/API review. PR1 is the complete `core/quantity` scope; it must not pull schema-provider or backend policy decisions into that package.

PR1 preserves the existing async provider contract, but it may change how the bundled BIS schema is made available to the sync path. A static or generated local schema allows the first sync call to construct `ResolvedBasicUnitsData` synchronously; the tradeoff is first-use CPU cost or increased module/bundle weight. If the package retains the dynamic JSON import, the sync methods report `BadUnit`/`error: true` until the existing async path has initialized the shared state, and the caller uses plain text rather than awaiting inside the transaction callback.

### PR2: `ecschema-metadata`, conditional

PR2 is a stacked, conditional metadata PR. It adds `getFormatSync()` to `FormatSetFormatsProvider` and `SchemaFormatsProvider` only if the field-format resolution path needs synchronous schema-format fallback. `SchemaUnitProvider` receives cache-only sync methods only if testing proves that the BasicUnitsProvider-only path cannot supply the required `UnitProps`; those methods must use already-loaded metadata and must not load schemas or references.

PR2 does not broaden the feature into arbitrary custom-unit conversion. If a required schema format or unit is not already available synchronously, the later text-fields integration uses plain text rather than awaiting or constructing a partial spec.

### Later backend integration

The text-fields integration PR owns the decision whether to replace the current `requirements`/`warmUp` interaction with on-demand synchronous construction. PR1 and conditional PR2 only provide capabilities; they do not prescribe backend evaluation policy. If the text-fields PR chooses on-demand construction, it can resolve the field's candidates, build the spec, insert it into `FieldSpecBucket._specs`, and format immediately. If it keeps the cache-only policy, async warm-up remains for providers or metadata that cannot answer synchronously. Either choice moves a deliberate tradeoff into the text-fields PR: on-demand construction adds first-use transaction cost, while cache-only evaluation requires preload/requirement coordination.

## Proposed synchronous flow

```text
field transaction callback
  → obtain property/value synchronously
  → obtain FormatDefinition through getFormatSync()
  → resolve format unit names through BasicUnitsProvider.findUnitByNameSync()
  → Format.createFromJSONSync()
  → FormatterSpec.createSync()
      → UnitConversions.getConversion()
  → cache FormatterSpec
  → FormatterSpec.applyFormatting()
  → persist cachedContent
```

If any required format or unit is unavailable synchronously, the callback does not load it, await it, or construct a partial spec. It uses the existing raw-value path as a plain-text fallback and records the miss according to the backend cache policy.

## Readiness and loading

`BasicUnitsProvider` currently loads `Units.json` lazily and caches the resolved state at module scope. The sync path may instead make the bundled schema statically available or generate an equivalent local module, then call `buildResolvedBasicUnitsData()` on first synchronous use. This does not load arbitrary schemas or perform asynchronous I/O; it only moves the bundled-data cost to module initialization or first use. If the bundled state is not synchronously available, required metadata is unavailable for this callback and the caller uses plain text.

The sync result policy is fixed: an unresolved or unknown unit returns `BadUnit`, and an unavailable or incompatible conversion returns the identity conversion with `error: true`. There is no separate readiness report.

The remaining implementation tradeoff is whether the package should preserve the current lazy JSON asset boundary or accept static/generated bundled data for a true first-call sync path. The choice needs bundle-size, startup, CJS, ESM, and browser-build validation, but it does not change the public sync result policy.

## Cache terminology

There are two different caches involved, and they must not be conflated:

- `BasicUnitsResolvedStateCache._resolvedData` is the module-level cache of bundled unit metadata and conversion data used by `BasicUnitsProvider`. PR1 may initialize this cache synchronously on first use when the bundled-data packaging supports it; otherwise a sync lookup reports unavailable state and the caller uses plain text.
- `FieldSpecBucket._specs` is the backend per-provider/per-FormatSet cache of `FormatterSpec` objects keyed by `specKey(args)`. The transaction callback currently performs a lookup in this map and falls back to raw text when no spec exists.

The question about synchronous construction on a cache miss refers to `FieldSpecBucket._specs`, not the BasicUnitsProvider state cache. That question is deferred to the later backend integration PR. PR1 does not change the backend spec-cache policy.

## Non-goals

- Synchronous loading of arbitrary schemas or schema references.
- Synchronous support for custom units.
- Changing the existing asynchronous provider contracts.
- Adding synchronous parser label lookup or unit-family enumeration.
- Replacing the current asynchronous warm-up path in PR1 or PR2. The later text-fields integration PR owns whether on-demand synchronous construction replaces `requirements`/`warmUp` for the paths that can answer synchronously.
- Discovering annotation field requirements automatically; that is a separate backend behavior change.

## Validation requirements

- Compare `BasicUnitsProvider.findUnitByNameSync()` results with the existing asynchronous lookup for representative length, area, temperature, angular, inverted, and ratio units.
- Compare `BasicUnitsProvider.getConversionSync()` with `UnitConversions.getConversion()` and the existing asynchronous provider result.
- Verify decimal, composite, ratio, azimuth, bearing, and numeric-only formats through both async and sync construction paths.
- Verify invalid canonical names and unavailable readiness use the defined plain-text fallback rather than producing a partial formatter.
- Verify `FormatSetFormatsProvider.getFormatSync()` does not await and correctly handles local definitions and unsupported asynchronous fallbacks.
- Verify the text-field transaction callback does not await and produces the same cached content as the existing pre-warmed path.
- Run the affected package type checks, tests, lint, and API extraction if new public beta exports are added.

## Remaining implementation questions

1. Which local-data packaging option should PR1 use for a true first-call sync path: static JSON import, generated TypeScript data, or the existing lazy asset plus prior async initialization? This is an implementation and bundle/startup tradeoff, not a readiness API decision.
2. Does PR2 need synchronous schema-format fallback, or is the BasicUnitsProvider plus explicit/local FormatSet path sufficient for the first consumer? `SchemaFormatsProvider` can use synchronous schema metadata access, but that work should not be pulled into PR1 without a consumer requirement.
3. Does PR2 need synchronous `SchemaUnitProvider` methods after the BasicUnitsProvider-only implementation is tested? The answer is “no” if all supported format and persistence unit names are canonical built-in names; the answer is “yes” only if schema metadata must supply `UnitProps` for the supported path.
4. The later text-fields PR must decide whether to build a `FormatterSpec` synchronously when `FieldSpecBucket._specs` misses, thereby replacing most `requirements`/`warmUp` interaction, or remain cache-only and record a miss for asynchronous warm-up. On-demand construction reduces preload coordination but moves format construction cost into the transaction callback; that decision is intentionally outside PR1 and conditional PR2.
