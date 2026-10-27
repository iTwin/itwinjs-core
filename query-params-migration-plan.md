# Map-layer query-parameter migration plan

Branch `MichelD/MapLayerAuthHeader`, PR [#9653](https://github.com/iTwin/itwinjs-core/pull/9653).

**Goal:** one persisted, non-secret parameter map (`queryParams`), secrets injected through the fetch handler; retire `savedQueryParams` / `unsavedQueryParams` without breaking existing code.

Applies to `ImageMapLayerSettings` (`@itwin/core-common`) and `MapLayerSource` (`@itwin/core-frontend`).

## 5.x (this PR)

| Member | Shape | Status |
|---|---|---|
| `savedQueryParams` | plain field (the storage, as before) | `@deprecated in 5.15. Use queryParams.` |
| `queryParams` | get/set accessor over `savedQueryParams` | new, `@beta` |
| `unsavedQueryParams` | plain field | `@deprecated in 5.15.` → inject through a `MapLayerFetchHandler` |
| `collectQueryParams()` | `{ ...queryParams, ...unsavedQueryParams }` | `@beta`, **not** deprecated; the single merge point |

Changes:

1. Swap the alias direction: the field stays `savedQueryParams`, `queryParams` is the accessor. Subclasses redeclaring `savedQueryParams` as a field and `delete settings.savedQueryParams` keep working (aruniverse P1).
2. Fix `ImageMapLayerSettings.clone()`: stop overwriting the `queryParams` produced by `cloneProps(changedProps)`, so `clone({ queryParams })` takes effect.
3. Route the three hand-merged sites through `collectQueryParams()`:
   - `MapLayerImageryProvider.appendCustomParams`
   - `OgcApiFeaturesFormat.validate` landing URL
   - `OgcApiFeaturesFormat.validate` collections URL

   Removes their `no-deprecated` suppressions and unifies precedence: `unsavedQueryParams` wins on a duplicated key everywhere (previously tile URLs let `queryParams` win while capability/validation paths let `unsavedQueryParams` win).
4. Tests: two-way sync between the names, `delete savedQueryParams` clears both and `toJSON()`, a subclass redeclaring `savedQueryParams` compiles and flows through `queryParams`/`toJSON()`, `clone({ queryParams })` replaces the parameters, duplicate-key precedence on a tile URL.
5. `docs/changehistory/NextVersion.md`: `queryParams` is an accessor over the existing property (subclasses and `delete` unaffected); mention the precedence unification.
6. `rush extract-api` for core-common and core-frontend; Rush change files.

## 6.0

- Remove `savedQueryParams` and `unsavedQueryParams`.
- `queryParams` stays an accessor (shape unchanged for consumers) over a private `_queryParams`.
- `collectQueryParams()` reduces to `{ ...queryParams }`; mark it `@deprecated in 6.0. Use queryParams.`; internal callers read `queryParams` directly.
- Migration note: `savedQueryParams` → `queryParams`; `unsavedQueryParams` → fetch handler.

## 7.0

- Remove `collectQueryParams()`.

## Invariants

- Persisted JSON (`ImageMapLayerProps.queryParams` / `MapLayerSourceProps.queryParams`) is unchanged throughout; no data migration.
- Each public member changes shape at most once: `savedQueryParams` (removed, 6.0), `unsavedQueryParams` (removed, 6.0), `collectQueryParams` (removed, 7.0), `queryParams` (never).
