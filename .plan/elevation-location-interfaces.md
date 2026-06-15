# Plan: Elevation, Geoid, and Location Provider Interfaces

**Issue:** https://github.com/iTwin/itwinjs-core/issues/7009
**Follows:** PR #9378 (Bing imagery deprecation)
**Package:** `@itwin/core-frontend`

## Goal

Define abstract interfaces in `core-frontend` for elevation, geoid, and location services. Align existing `BingElevationProvider` and `BingLocationProvider` as deprecated implementations of those interfaces. Migrate all internal call sites to use provider slots on `IModelApp`. This decouples core-frontend from Bing, enabling replacement implementations to live outside core (like imagery did via `@itwin/map-layers-formats`).

## Release Tags

All new interfaces and the three `IModelApp` provider slots are `@beta @extensions`.

Rationale: the interface shapes are still being validated — specifically the
`getGeodeticToSeaLevelOffset` signature change from `(Point3d, IModelConnection)` to
`(Cartographic)`, and dropping the `geodetic` parameter from `getHeight` on the interface.
`@beta` lets these settle before a replacement provider ships, without a breaking-change
commitment. Do NOT promote to `@public` (premature lock) and do NOT use `@internal`
(extensions must be able to implement and supply these). The deprecated `BingElevationProvider`
and `BingLocationProvider` classes keep their existing `@public @extensions` tags.

## Key Decisions

### Three separate interfaces, not one combined ElevationProvider

Decision: three interfaces (`ElevationProvider`, `GeoidProvider`, `LocationProvider`).

Rationale: terrain height (ground shape) and geoid undulation (gravity model) are
independent data sources. Future providers (e.g. Cesium terrain) can supply height but
not geoid. Location/geocoding is unrelated to both.

Rejected: single combined `ElevationProvider` with all three categories — would force
every height-only provider to stub geoid methods.

### Default to Bing, not undefined

Decision: `IModelApp` slots eagerly default to `BingElevationProvider` / `BingLocationProvider`.

Rationale: no behavioral regression for existing apps with Bing keys. The deprecation
warning nudges migration; actual removal happens in a future major version.

Rejected: default `undefined` — would silently zero out elevation/geoid for every existing
Bing-consuming app with no compile-time signal. The 2028 failure mode (silent zeros) is
identical either way; defaulting to undefined just moves the pain to now.

### Shared Bing instance for elevation + geoid

Decision: one `BingElevationProvider` instance serves both the elevation and geoid slots.

Rationale: `BingElevationProvider` implements both interfaces. Avoids double construction
and divergent state.

Rejected: two separate instances — wasteful, no benefit.

### Deprecation version

Use `@deprecated in 5.11.0.` (current dev version from `core/frontend/package.json`).
The pipeline auto-adds the date. Do NOT use placeholder `4.x` or `5.x`.

### Convenience methods off the interface

Decision: `getHeightRange` / `getHeightAverage` become standalone `@beta @extensions` utility
functions, NOT methods on `ElevationProvider`.

Rationale: they're pure `getHeights` + math with zero real callers found across GitHub iTwin
org and Azure DevOps. Keeping the interface minimal.

Rejected: on the interface — forces every provider to reimplement identical boilerplate.

### GeoidProvider interface takes Cartographic, not Point3d

Decision: `GeoidProvider.getGeodeticToSeaLevelOffset(carto: Cartographic)` — callers convert
`Point3d` to `Cartographic` before calling.

Rationale: moves the iModel dependency out of the geoid contract. The conversion is the
caller's responsibility. The old `BingElevationProvider` overload `(Point3d, IModelConnection)`
stays as a deprecated convenience.

Rejected: interface takes `Point3d` + `IModelConnection` — leaks iModel dependency into a
pure geospatial contract.

**Important:** callers must guard `undefined` from `iModel.spatialToCartographicFromEcef()`.
The original Bing code does `if (carto === undefined) return 0.0;`. Each migrated call site
must replicate this guard.

## Interfaces

### `ElevationProvider` — `core/frontend/src/ElevationProvider.ts`

```typescript
import { Cartographic } from "@itwin/core-common";
import { Range1d, Range2d } from "@itwin/core-geometry";
import { IModelConnection } from "./IModelConnection";

/** Provides terrain elevation data.
 * @beta @extensions
 */
export interface ElevationProvider {
  /** Return the height (altitude) at a given cartographic location.
   * Height is geodetic (WGS84 ellipsoid).
   */
  getHeight(carto: Cartographic): Promise<number>;

  /** Return a grid of elevations within the specified range.
   * Returns undefined if elevation data is unavailable for the range.
   */
  getHeights(range: Range2d): Promise<number[] | undefined>;
}

/** Compute the elevation range for an iModel's project extents using the given provider.
 * @beta @extensions
 */
export async function getHeightRange(provider: ElevationProvider, iModel: IModelConnection): Promise<Range1d> {
  // Copy verbatim from BingElevation.ts lines 108-123, replacing this.getHeights with provider.getHeights.
  // Preserve the expandInPlace(1000) on the range, and return Range1d.createNull() when heights are undefined.
  const latLongRange = Range2d.createNull();
  const range = iModel.projectExtents.clone();
  range.expandInPlace(1000);
  for (const corner of range.corners()) {
    const carto = iModel.spatialToCartographicFromEcef(corner);
    latLongRange.extendXY(carto.longitudeDegrees, carto.latitudeDegrees);
  }
  const heights = await provider.getHeights(latLongRange);
  return heights ? Range1d.createArray(heights) : Range1d.createNull();
}

/** Compute the average elevation for an iModel's project extents using the given provider.
 * @beta @extensions
 */
export async function getHeightAverage(provider: ElevationProvider, iModel: IModelConnection): Promise<number> {
  // Copy verbatim from BingElevation.ts lines 126-138, replacing this.getHeights with provider.getHeights.
  // Return 0 when heights are undefined or empty.
  const latLongRange = Range2d.createNull();
  for (const corner of iModel.projectExtents.corners()) {
    const carto = iModel.spatialToCartographicFromEcef(corner);
    latLongRange.extendXY(carto.longitudeDegrees, carto.latitudeDegrees);
  }
  const heights = await provider.getHeights(latLongRange);
  if (!heights || !heights.length)
    return 0;
  let total = 0.0;
  for (const height of heights)
    total += height;
  return total / heights.length;
}
```

### `GeoidProvider` — `core/frontend/src/GeoidProvider.ts`

```typescript
import { Cartographic } from "@itwin/core-common";

/** Provides geoid undulation — the offset between the geodetic ellipsoid (WGS84) and sea level (EGM2008).
 * @beta @extensions
 */
export interface GeoidProvider {
  /** Return the offset from geodetic height to sea level height at the given cartographic location. */
  getGeodeticToSeaLevelOffset(carto: Cartographic): Promise<number>;
}
```

### `LocationProvider` — `core/frontend/src/LocationProvider.ts`

```typescript
import { GlobalLocation } from "./ViewGlobalLocation";

/** Provides geocoding — converting a query string to a geographic location.
 * @beta @extensions
 */
export interface LocationProvider {
  /** Return the location for a query string, or undefined if not found. */
  getLocation(query: string): Promise<GlobalLocation | undefined>;
}
```

## IModelApp Integration

### `IModelAppOptions` additions

```typescript
/** Supplies the elevation provider for this session.
 * Defaults to [[BingElevationProvider]] if not specified.
 * @beta
 */
elevationProvider?: ElevationProvider;

/** Supplies the geoid provider for this session.
 * Defaults to [[BingElevationProvider]] if not specified (it implements both interfaces).
 * @beta
 */
geoidProvider?: GeoidProvider;

/** Supplies the location provider for this session.
 * Defaults to [[BingLocationProvider]] if not specified.
 * @beta
 */
locationProvider?: LocationProvider;
```

### `IModelApp.ts` — imports and fields

Add these imports:
```typescript
import { ElevationProvider } from "./ElevationProvider";
import { GeoidProvider } from "./GeoidProvider";
import { LocationProvider } from "./LocationProvider";
import { BingLocationProvider } from "./BingLocation";
// BingElevationProvider already reachable via "./tile/internal" — reuse existing import.
```

Add private static fields (near the existing `_terrainProviderRegistry` field around line 215):
```typescript
private static _elevationProvider: ElevationProvider;
private static _geoidProvider: GeoidProvider;
private static _locationProvider: LocationProvider;
```

Add public static getters:
```typescript
/** The [[ElevationProvider]] for this session.
 * @beta
 */
public static get elevationProvider(): ElevationProvider { return this._elevationProvider; }

/** The [[GeoidProvider]] for this session.
 * @beta
 */
public static get geoidProvider(): GeoidProvider { return this._geoidProvider; }

/** The [[LocationProvider]] for this session.
 * @beta
 */
public static get locationProvider(): LocationProvider { return this._locationProvider; }
```

In `startup()` (near the existing `_terrainProviderRegistry` init around line 437):
```typescript
const defaultBingElevation = new BingElevationProvider();
this._elevationProvider = opts.elevationProvider ?? defaultBingElevation;
this._geoidProvider = opts.geoidProvider ?? defaultBingElevation;
this._locationProvider = opts.locationProvider ?? new BingLocationProvider();
```

## Deprecation

### `BingElevationProvider` — `core/frontend/src/tile/map/BingElevation.ts`

```typescript
/** @deprecated in 5.11.0. Use [[ElevationProvider]] and [[GeoidProvider]] via
 * [[IModelAppOptions.elevationProvider]] and [[IModelAppOptions.geoidProvider]].
 * @public
 * @extensions
 */
export class BingElevationProvider implements ElevationProvider, GeoidProvider {
```

The class needs these changes to satisfy the interfaces:
- `getHeight(carto: Cartographic)` — already exists with signature `(carto: Cartographic, geodetic = true)`.
  The extra `geodetic` param with a default is compatible with the interface's `(carto: Cartographic)`.
- `getHeights(range: Range2d)` — already matches.
- `getGeodeticToSeaLevelOffset(carto: Cartographic)` — currently `(point: Point3d, iModel: IModelConnection)`.
  Add a new overload that takes `Cartographic` to satisfy the interface. Keep the old signature as
  a deprecated overload for backward compat:
  ```typescript
  /** @deprecated in 5.11.0. Use the Cartographic overload instead. */
  public async getGeodeticToSeaLevelOffset(point: Point3d, iModel: IModelConnection): Promise<number>;
  /** Satisfies [[GeoidProvider]]. */
  public async getGeodeticToSeaLevelOffset(carto: Cartographic): Promise<number>;
  public async getGeodeticToSeaLevelOffset(pointOrCarto: Point3d | Cartographic, iModel?: IModelConnection): Promise<number> {
    let carto: Cartographic;
    if (pointOrCarto instanceof Cartographic) {
      carto = pointOrCarto;
    } else {
      carto = iModel!.spatialToCartographicFromEcef(pointOrCarto);
      if (carto === undefined)
        return 0.0;
    }
    // ... existing HTTP request logic using carto.latitudeDegrees, carto.longitudeDegrees
  }
  ```

Additional deprecations on convenience methods:
```typescript
/** @deprecated in 5.11.0. Use standalone [[getHeightRange]] function instead. */
public async getHeightRange(iModel: IModelConnection) { ... }

/** @deprecated in 5.11.0. Use standalone [[getHeightAverage]] function instead. */
public async getHeightAverage(iModel: IModelConnection) { ... }

/** @deprecated in 5.11.0. Use [[ElevationProvider.getHeight]] via [[IModelApp.elevationProvider]] instead. */
public async getHeightValue(point: Point3d, iModel: IModelConnection, geodetic = true): Promise<number> { ... }
```

### `BingLocationProvider` — `core/frontend/src/BingLocation.ts`

```typescript
/** @deprecated in 5.11.0. Use [[LocationProvider]] via [[IModelAppOptions.locationProvider]].
 * @public
 * @extensions
 */
export class BingLocationProvider implements LocationProvider {
```

No signature changes needed — `getLocation(query: string)` already matches.

## Barrel Exports

### `core/frontend/src/core-frontend.ts`

Add these three lines near the existing `export * from "./BingLocation";` (around line 9):
```typescript
export * from "./ElevationProvider";
export * from "./GeoidProvider";
export * from "./LocationProvider";
```

Do NOT add to the curated `export { ... } from "./tile/internal"` block.
`BingElevationProvider` stays in the curated block where it already is (line 139).

### `core/extension/index.d.ts`

Add the new interfaces as **type-only** exports. Add `getHeightRange` and `getHeightAverage`
as value exports if extensions should have access to the utilities.

Do NOT add `ElevationProvider`, `GeoidProvider`, or `LocationProvider` to `ExtensionRuntime.ts`
runtime value list — they are interfaces (types), not runtime values.

## Internal Migration

All internal call sites stop constructing `BingElevationProvider`/`BingLocationProvider`
directly and use the `IModelApp` slots instead.

### `IModelConnection.geodeticToSeaLevel` (`@internal`) — lines 597-608

```typescript
// Before:
const elevationProvider = new BingElevationProvider();
this._geodeticToSeaLevel = elevationProvider.getGeodeticToSeaLevelOffset(this.projectExtents.center, this);

// After:
const carto = this.spatialToCartographicFromEcef(this.projectExtents.center);
if (carto === undefined) {
  this._geodeticToSeaLevel = 0.0;
  return 0.0;
}
this._geodeticToSeaLevel = IModelApp.geoidProvider.getGeodeticToSeaLevelOffset(carto);
```

### `IModelConnection.projectCenterAltitude` (`@internal`) — lines 613-624

```typescript
// Before:
const elevationProvider = new BingElevationProvider();
this._projectCenterAltitude = elevationProvider.getHeightValue(this.projectExtents.center, this);

// After:
const carto = this.spatialToCartographicFromEcef(this.projectExtents.center);
if (carto === undefined) {
  this._projectCenterAltitude = 0.0;
  return 0.0;
}
this._projectCenterAltitude = IModelApp.elevationProvider.getHeight(carto);
```

### `queryTerrainElevationOffset` (`@public`) — `ViewGlobalLocation.ts` lines 62-74

```typescript
// Before:
const bingElevationProvider = new BingElevationProvider();
// ... bingElevationProvider.getHeight(carto, ...)

// After — use IModelApp.elevationProvider:
const elevationOffset = await IModelApp.elevationProvider.getHeight(carto);
```

No signature change: `(viewport, carto) => Promise<number>`. Non-breaking.

Remove the `import { BingElevationProvider } from "./tile/internal";` from this file.

### `MapTileTree.computeHeightBias` (private) — line 672

```typescript
// Before:
private async computeHeightBias(..., elevationProvider: BingElevationProvider): Promise<number> {
  // Ground mode: elevationProvider.getHeightValue(projectCenter, iModel, true)
  // Geoid mode: elevationProvider.getGeodeticToSeaLevelOffset(projectCenter, iModel)

// After:
private async computeHeightBias(heightOrigin: number, heightOriginMode: TerrainHeightOriginMode,
    exaggeration: number, iModel: IModelConnection): Promise<number> {
  const projectCenter = iModel.projectExtents.center;
  switch (heightOriginMode) {
    case TerrainHeightOriginMode.Ground: {
      const carto = iModel.spatialToCartographicFromEcef(projectCenter);
      if (carto === undefined) return heightOrigin;
      return heightOrigin + exaggeration * (await IModelApp.elevationProvider.getHeight(carto));
    }
    case TerrainHeightOriginMode.Geodetic:
      return heightOrigin;
    case TerrainHeightOriginMode.Geoid: {
      const carto = iModel.spatialToCartographicFromEcef(projectCenter);
      if (carto === undefined) return heightOrigin;
      return heightOrigin + await IModelApp.geoidProvider.getGeodeticToSeaLevelOffset(carto);
    }
  }
}
```

### `MapTileTree.createTileTree` (private) — lines 699-705

```typescript
// Before:
const elevationProvider = new BingElevationProvider();
bimElevationBias = - await this.computeHeightBias(..., elevationProvider);
geodeticOffset = await elevationProvider.getGeodeticToSeaLevelOffset(iModel.projectExtents.center, iModel);

// After:
bimElevationBias = - await this.computeHeightBias(id.terrainHeightOrigin, id.terrainHeightOriginMode, id.terrainExaggeration, iModel);
const carto = iModel.spatialToCartographicFromEcef(iModel.projectExtents.center);
geodeticOffset = carto ? await IModelApp.geoidProvider.getGeodeticToSeaLevelOffset(carto) : 0;
```

Remove `BingElevationProvider` from the import list in `MapTileTree.ts`.

### `ViewGlobeLocationTool` — `ViewTool.ts` around line 3419

```typescript
// Before:
const bingLocationProvider = new BingLocationProvider();
this._globalLocation = await bingLocationProvider.getLocation(locationString);

// After:
this._globalLocation = await IModelApp.locationProvider.getLocation(locationString);
```

Remove the `BingLocationProvider` import from `ViewTool.ts`.

## Changelog & Docs (required before push)

1. `rush change` (non-interactive, bump type `"none"`) for `@itwin/core-frontend`;
   commit the generated JSON under `common/changes/@itwin/core-frontend/`.
2. `docs/changehistory/NextVersion.md`: add a "### Geospatial provider interfaces" entry
   documenting `[ElevationProvider]($frontend)`, `[GeoidProvider]($frontend)`,
   `[LocationProvider]($frontend)`, the new `IModelAppOptions` slots, and a migration
   example replacing `new BingElevationProvider()` with `IModelApp.elevationProvider`.
   Use `[ClassName]($package)` link syntax.
3. `rush extract-api`; commit `common/api/core-frontend.api.md`. After running, follow the
   AGENTS.md guard: re-check union-type ordering lines against CI canonical form.

## What's NOT in Scope

- **Replacement providers (Azure/Cesium/EGM2008)** — separate PRs in a different package.
- **`MapLayerOptions.BingMaps` deprecation** — still required by the default Bing providers.
- **CesiumTerrainProvider implementing ElevationProvider** — separate follow-up.
- **New package for implementations** — defer until a real implementation exists.
- **Vitest/Mocha config changes** — none expected.
- **New unit tests** — out of scope this wave; existing tests must still pass.
- **`display-test-app` BingTerrainProvider edits** — leave as-is; its deprecation warning is expected.
- **A `null`/no-op default provider** — default is Bing; do not introduce an undefined-default path.

## Validation

1. `rushx build` in `core/frontend` — compile check
2. `rushx test` in `core/frontend` — existing tests pass
3. `rush extract-api` — review `.api.md` diffs: new interfaces appear as `@beta`, deprecations visible
4. Manual: existing apps with Bing keys behave identically (default Bing providers)
5. Manual: apps that set custom providers see their provider used instead of Bing

### Inspection invariants (verify by reading, before commit)
- [ ] `grep -rn "new BingElevationProvider()" core/frontend/src` returns ONLY `IModelApp.ts`
      (the single default instance). Zero matches in `IModelConnection.ts`, `MapTileTree.ts`,
      `ViewGlobalLocation.ts`.
- [ ] `grep -rn "new BingLocationProvider()" core/frontend/src` returns ONLY `IModelApp.ts`.
      Zero matches in `tools/ViewTool.ts`.
- [ ] Each migrated geoid call site guards undefined:
      `const carto = iModel.spatialToCartographicFromEcef(center); if (!carto) return 0.0;`
      present in `IModelConnection.geodeticToSeaLevel`, `MapTileTree.computeHeightBias`
      (Geoid case), and `MapTileTree.createTileTree`.
- [ ] `ElevationProvider`, `GeoidProvider`, `LocationProvider` are each tagged `@beta @extensions`.
- [ ] `IModelApp.elevationProvider` / `.geoidProvider` / `.locationProvider` getters are tagged `@beta`.
- [ ] `BingElevationProvider` is `@deprecated in 5.11.0.` AND still `@public @extensions`;
      `implements ElevationProvider, GeoidProvider`.
- [ ] `BingLocationProvider` is `@deprecated in 5.11.0.` AND still `@public @extensions`;
      `implements LocationProvider`.
- [ ] `core-frontend.ts` contains exactly three new `export *` lines for the new files.
- [ ] `core/extension/index.d.ts`: interfaces are type-only exports; NOT in `ExtensionRuntime.ts` runtime list.
- [ ] `common/changes/@itwin/core-frontend/*.json` exists with bump type `"none"`.
- [ ] `docs/changehistory/NextVersion.md` has a geospatial-providers entry with a migration example.
- [ ] `common/api/core-frontend.api.md` regenerated; AGENTS.md union-ordering guard re-checked.

---

## Spec Contract

> This section is machine-readable. Any model executing this plan must verify all
> assertions below before marking work complete. Do not skip. Do not approximate.

### Out of Scope — Do Not Add

- **Replacement providers (Azure/Cesium/EGM2008)** — separate PRs in a different package.
- **`MapLayerOptions.BingMaps` deprecation** — still required by the default Bing providers.
- **CesiumTerrainProvider implementing ElevationProvider** — separate follow-up.
- **New package for implementations** — defer until a real implementation exists.
- **New unit tests** — out of scope this wave; existing tests must still pass.
- **`display-test-app` BingTerrainProvider edits** — leave as-is; deprecation warning expected.
- **A `null`/no-op default provider** — default is Bing; do not add undefined-default paths.

### Decision Record — Do Not Override

| Symbol / File | Decision | Rationale | Rejected Alternative |
|---|---|---|---|
| `ElevationProvider`, `GeoidProvider`, `LocationProvider` | `@beta @extensions` | Shapes still settling; allow iteration | `@public` — premature lock; `@internal` — blocks extension implementers |
| Interface split | 3 separate interfaces | Height vs gravity vs geocoding are independent data sources | Single combined `ElevationProvider` — forces geoid stubs |
| `IModelApp` slot defaults | Eager `BingElevationProvider`/`BingLocationProvider` | No behavioral regression for existing Bing apps | `undefined` default — silent zeroing, no compile signal |
| Bing instance | One shared instance for elevation + geoid slots | Both interfaces implemented; avoid double construction | Two instances — wasteful |
| `getGeodeticToSeaLevelOffset` | Interface takes `Cartographic` | Moves iModel dependency out of geoid contract | `(Point3d, IModelConnection)` — leaks iModel into geoid |
| `getHeightRange`/`getHeightAverage` | Standalone `@beta` utility functions | Pure `getHeights` + math; zero real callers | On interface — forces provider reimplementation |
| Deprecation version | `@deprecated in 5.11.0.` | Concrete version from package.json; pipeline auto-adds date | `4.x` placeholder — nondeterministic |

### Seam Contracts — Exact Import Statements

**`core/frontend/src/ElevationProvider.ts`:**
```typescript
import { Cartographic } from "@itwin/core-common";
import { Range1d, Range2d } from "@itwin/core-geometry";
import { IModelConnection } from "./IModelConnection";
```

**`core/frontend/src/GeoidProvider.ts`:**
```typescript
import { Cartographic } from "@itwin/core-common";
```

**`core/frontend/src/LocationProvider.ts`:**
```typescript
import { GlobalLocation } from "./ViewGlobalLocation";
```

**`core/frontend/src/core-frontend.ts` additions (near `export * from "./BingLocation";`):**
```typescript
export * from "./ElevationProvider";
export * from "./GeoidProvider";
export * from "./LocationProvider";
```

**`core/frontend/src/IModelApp.ts` additions:**
```typescript
import { ElevationProvider } from "./ElevationProvider";
import { GeoidProvider } from "./GeoidProvider";
import { LocationProvider } from "./LocationProvider";
import { BingLocationProvider } from "./BingLocation";
```

### Invariants — Verify Before Committing

- [ ] `grep -rn "new BingElevationProvider()" core/frontend/src` → matches ONLY `IModelApp.ts`.
- [ ] `grep -rn "new BingLocationProvider()" core/frontend/src` → matches ONLY `IModelApp.ts`.
- [ ] `ElevationProvider` / `GeoidProvider` / `LocationProvider` tagged `@beta @extensions`.
- [ ] `IModelApp.elevationProvider` / `.geoidProvider` / `.locationProvider` getters tagged `@beta`.
- [ ] `BingElevationProvider` is `@deprecated in 5.11.0.` AND still `@public @extensions`; `implements ElevationProvider, GeoidProvider`.
- [ ] `BingLocationProvider` is `@deprecated in 5.11.0.` AND still `@public @extensions`; `implements LocationProvider`.
- [ ] Each geoid call site: `const carto = iModel.spatialToCartographicFromEcef(...); if (!carto/carto === undefined) return 0.0;`.
- [ ] `core-frontend.ts` has exactly three new `export *` lines.
- [ ] Interfaces NOT in `ExtensionRuntime.ts` runtime value list.
- [ ] `common/changes/@itwin/core-frontend/*.json` exists with bump `"none"`.
- [ ] `docs/changehistory/NextVersion.md` has migration entry.
- [ ] `common/api/core-frontend.api.md` regenerated; AGENTS.md union-ordering checked.
