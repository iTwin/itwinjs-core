---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Pluggable Cesium Ion authentication via `CesiumAccessClient`](#pluggable-cesium-ion-authentication-via-cesiumaccessclient)
    - [Configurable precision for graphical editing at high coordinates](#configurable-precision-for-graphical-editing-at-high-coordinates)
    - [`IModelConnection.createQueryReader` now terminates gracefully if the connection is closed](#imodelconnectioncreatequeryreader-now-terminates-gracefully-if-the-connection-is-closed)
    - [Reality model tiles with JSON glTF content now render](#reality-model-tiles-with-json-gltf-content-now-render)
    - [Quantity property description classes deprecated](#quantity-property-description-classes-deprecated)
    - [Bing Maps deprecation and new geospatial provider interfaces](#bing-maps-deprecation-and-new-geospatial-provider-interfaces)
    - [Graphics no longer disappear when a new category is inserted](#graphics-no-longer-disappear-when-a-new-category-is-inserted)
  - [@itwin/core-geometry](#itwincore-geometry)
    - [`CurveFactory.createFilletsInLineString` expanded options](#curve-factory-create-fillets-in-line-string-expanded-options)
  - [@itwin/core-backend](#itwincore-backend)
    - [ChangesetReader.setBatchSize](#changesetreadersetbatchsize)
  - [@itwin/map-layers-formats](#itwinmap-layers-formats)
    - [Azure Maps basemap support is available through map-layers-formats](#azure-maps-basemap-support-is-available-through-map-layers-formats)
  - [@itwin/build-tools](#itwinbuild-tools)
    - [`mocha` is now an optional peer dependency](#mocha-is-now-an-optional-peer-dependency)

## @itwin/core-frontend

### Pluggable Cesium Ion authentication via `CesiumAccessClient`

A new [CesiumAccessClient]($frontend) interface and [TileAdmin.Props.cesiumAccess]($frontend) option let apps plug in a custom Cesium asset resolver (such as the [iTwin Platform Cesium Curated Content API](https://developer.bentley.com/apis/cesium-curated-content/overview/)) without requiring a personal Cesium Ion subscription or adding a platform dependency to `@itwin/core-frontend`.

Two authentication paths coexist:

| Path | When to use | How to configure |
|---|---|---|
| `cesiumIonKey` (existing) | App has a direct Cesium Ion subscription | `tileAdmin: { cesiumIonKey: "my-key" }` |
| `cesiumAccess` (new, `@beta`) | iTwin Platform proxy or any custom resolver | `tileAdmin: { cesiumAccess: new MyClient() }` |

When both are supplied, `cesiumAccess` takes precedence. The new [TileAdmin.canAccessCesium]($frontend) getter returns `true` if either option is configured.

```typescript
import { GuidString } from "@itwin/core-bentley";
import { CesiumAccessClient, CesiumAssetEndpoint } from "@itwin/core-frontend";

// Example: implement CesiumAccessClient using the iTwin Platform Cesium Curated Content API.
class ITPCesiumClient implements CesiumAccessClient {
  constructor(private readonly getAccessToken: () => Promise<string>) {}

  async getAssetEndpoint(assetId: string, _iTwinId?: GuidString): Promise<CesiumAssetEndpoint | undefined> {
    const token = await this.getAccessToken();
    const response = await fetch(`https://api.bentley.com/curated-content/cesium/${assetId}/tiles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok)
      return undefined; // asset cannot be accessed

    const json = await response.json();
    return {
      accessToken: json.accessToken,
      url: json.url,
      expiresAt: json.expiresAt ? new Date(json.expiresAt) : undefined,
    };
  }
}

// Register at startup:
await IModelApp.startup({
  tileAdmin: {
    cesiumAccess: new ITPCesiumClient(() => myAuthClient.getAccessToken()),
  },
});
```

### Configurable precision for graphical editing at high coordinates

During a [GraphicalEditingScope]($frontend), graphics for modified elements that are georeferenced far from the coordinate system origin could exhibit float32 precision artifacts such as jagged curves. The new [GraphicalEditingScope.dynamicGraphicsAbsolutePositionThreshold]($frontend) property sets the world-space coordinate magnitude (in meters) beyond which such graphics use `rtcCenter` centering to preserve precision, at a small performance cost. It defaults to 10 kilometers. Set it before making edits, as it is read once per model when that model's first element is modified.

```ts
const scope = await briefcase.enterEditingScope();
scope.dynamicGraphicsAbsolutePositionThreshold = 50_000;
```

For framework code that does not directly enter the scope, configure the threshold from [GraphicalEditingScope.onEnter]($frontend), which runs before any edits:

```ts
GraphicalEditingScope.onEnter.addListener((scope) => {
  scope.dynamicGraphicsAbsolutePositionThreshold = 50_000;
});
```

This changes the default behavior for existing projects: previously dynamic editing graphics always used absolute positions, but elements now centered 10 km or more from the origin automatically switch to `rtcCenter` centering. Projects within 10 km are unaffected. To restore the prior behavior, set the threshold to `Number.POSITIVE_INFINITY`.

### `IModelConnection.createQueryReader` now terminates gracefully if the connection is closed

Previously, if an [IModelConnection]($frontend) was closed between the call to [IModelConnection.createQueryReader]($frontend) and the first iteration of its results, it ended up throwing during the underlying RPC call.

The `IModelConnection.createQueryReader` executor now checks [IModelConnection.isOpen]($frontend) before attempting any RPC call. If the connection is already closed at the time of the first or any subsequent read, the reader terminates immediately with no rows. No error is thrown.

Callers that previously relied on a thrown error to detect connection closure should check `imodel.isOpen` before or after iteration instead.

**Example**

```typescript
const reader = imodel.createQueryReader("SELECT ECInstanceId FROM bis.Element");
await imodel.close(); // connection closes before iteration
const rows = await reader.toArray(); // used to throw, now returns an empty array
```

### Reality model tiles with JSON glTF content now render

A 3D Tileset may reference its tile content as plain-text JSON glTF (`.gltf`) rather than binary glTF (`.glb`) or b3dm. Previously such tiles either rendered nothing (the JSON content was discarded because it has no binary magic number) or rendered untextured/white (externally-referenced images resolved against the tileset root instead of the tile's content URL).

Reality tile content with no recognized binary magic number is now treated as glTF when the tile's content URL ends in `.gltf`, and externally-referenced resources resolve against the tile's own content URL so their textures load. No API or application changes are required.

### Quantity property description classes deprecated

The quantity property description classes [LengthDescription]($frontend), [SurveyLengthDescription]($frontend), [EngineeringLengthDescription]($frontend), [AngleDescription]($frontend), and their [FormattedQuantityDescription]($frontend) base class are now deprecated.

These appui-based helpers were introduced when quantity formatting was driven by `QuantityType`, but new quantity formatting work should use `kindOfQuantityName`-based APIs instead.

Most callers can migrate to [createQuantityDescription]($frontend), which builds a plain [PropertyDescription]($appui-abstract) with synchronous quantity formatting and parsing callbacks backed by [IModelApp.quantityFormatter]($frontend).

`SurveyLengthDescription` is the notable exception: its legacy behavior selects survey-style display units in unit systems where survey and engineering length formats differ. Applications that need to preserve that behavior should provide the desired format through a dedicated [FormatsProvider]($quantity) such as [FormatSetFormatsProvider]($ecschema-metadata). For more information, see the quantity learning docs on [Quantity property descriptions](../quantity-formatting/usage/ParsingAndFormatting.md#quantity-property-descriptions), [Format Sets](../quantity-formatting/definitions/FormatSets.md), and [Providers](../quantity-formatting/usage/Providers.md).

Existing uses of the deprecated classes continue to behave as before, and the classes will not be removed before a future major release.

### Bing Maps deprecation and new geospatial provider interfaces

[Bing Maps from Azure](https://azure.microsoft.com/en-us/products/bing-maps) will be retired and go offline in 2028. This release deprecates all Bing-dependent APIs in `@itwin/core-frontend` and introduces abstract provider interfaces so applications can migrate to alternative services.

#### What's new

New `@beta` interfaces decouple elevation, geoid, and location services from the Bing Maps implementation:

- [ElevationProvider]($frontend) — terrain height lookup.
- [GeoidProvider]($frontend) — geodetic-to-sea-level offset.
- [LocationProvider]($frontend) — geocoding (query string to location).

These can be supplied via the new `geospatialProviders` option on [IModelAppOptions]($frontend):

```typescript
await IModelApp.startup({
  geospatialProviders: {
    elevationProvider: myElevationProvider,
    geoidProvider: myGeoidProvider,
    locationProvider: myLocationProvider,
  },
});
```

If not supplied, [BingElevationProvider]($frontend) and [BingLocationProvider]($frontend) are used as defaults for backward compatibility. These Bing-backed defaults will be removed in a future major version; applications should migrate to a custom implementation before then.

Standalone utility functions [getHeightRange]($frontend) and [getHeightAverage]($frontend) replace the convenience methods previously on `BingElevationProvider`.

For new basemap imagery, prefer Azure Maps via `@itwin/map-layers-formats`.

#### What's deprecated

[MapLayerOptions.BingMaps]($frontend), [BingElevationProvider]($frontend), [BingLocationProvider]($frontend), and the Bing Maps imagery APIs (`BingMapsMapLayerFormat`, `BingMapsImageryLayerProvider`) are all deprecated. Existing persisted Bing-backed styles continue to load for compatibility, but new code should use Azure Maps or another provider.

Migrate elevation and location by replacing direct construction with the `IModelApp` provider slots:

```typescript
// Before
const provider = new BingElevationProvider();
const height = await provider.getHeightValue(point, iModel);

// After
if (iModel.isGeoLocated) {
  const carto = iModel.spatialToCartographicFromEcef(point);
  const height = await IModelApp.elevationProvider.getHeight(carto);
}
```

### Graphics no longer disappear when a new category is inserted

Inserting a new `Category` also inserts that category's default `SubCategory`. The frontend's subcategory cache previously responded to *any* `SubCategory` insertion by clearing its entire contents, as the change notification does not identify which category the new subcategory belongs to. Because [Viewport]($frontend) rendering derives the set of visible subcategories from that cache, clearing it made every already-viewed category appear to have no subcategories, so all graphics disappeared until an unrelated action (such as toggling a category in the [CategorySelectorState]($frontend)) repopulated the cache.

The cache now keeps serving the previously-loaded data and instead marks the affected categories as stale, reloading them in the background. Already-viewed graphics remain visible throughout, and the [Viewport]($frontend) automatically reloads and repaints the affected categories.

## @itwin/core-geometry

### `CurveFactory.createFilletsInLineString` expanded options

[CurveFactory.createFilletsInLineString]($core-geometry) has three new [CreateFilletsInLineStringOptions]($core-geometry) interface options to control the construction of the output `Path`, particularly with respect to the appearance of cusps in the output. A _cusp_ occurs when a fillet's radius is too large, and the arc consumes one or both adjacent line string edges. Cusps in the output of this method (especially large cusps) are generally considered to be undesirable.

[CreateFilletsInLineStringOptions.closureTolerance]($core-geometry) is used when [CreateFilletsInLineStringOptions.filletClosure]($core-geometry) is `true` to determine whether the final input point is to be considered equal to the first input point. If these points have distance less than `closureTolerance`, the final point is ignored when the input polygon is filleted. The default value of this option is [Geometry.smallMetricDistance]($core-geometry), matching previous behavior.

[CreateFilletsInLineStringOptions.cuspSegments]($core-geometry) is used when [CreateFilletsInLineStringOptions.allowCusp]($core-geometry) is `true` to insert a `LineSegment3d` in the output `Path` at each cusp. These extra `Path` children are retrograde line segments that bridge the gap formed by each cusp and thereby maintain the chain's continuity. To avoid these extra output segments, the caller can pass `cuspSegments = false` at the cost of chain discontinuity (if the gaps are small enough, they may be tolerated by chain processing downstream). The default value of this option is `true`, matching previous behavior.

[CreateFilletsInLineStringOptions.cuspTolerance]($core-geometry) is used when [CreateFilletsInLineStringOptions.allowCusp]($core-geometry) is `true` to determine whether to suppress large cusps in the output. A cusp segment whose length exceeds `cuspTolerance` will be eliminated in the output `Path` by the removal of one or both of its constituent fillet arcs. The default value of this option is [Geometry.smallMetricDistance]($core-geometry), which is a slight deviation from previous default behavior. The new default behavior allows only miniscule cusps, whereas the old default behavior allowed cusps of any size. The old default behavior is considered to be a bug.

## @itwin/core-backend

### ChangesetReader.setBatchSize

[ChangesetReader]($backend) now exposes a `setBatchSize(n: number)` method that controls how many change rows are cached in the reader. It is a performance improvement parameter that can be tweaked as per user's choice. Increasing the batch size increases the number of rows read at once and cached in the reader, thereby improving throughput when iterating large changesets but it also increases memory consumption; decreasing it reduces peak memory use. The method must be called before the first [ChangesetReader.step]($backend) call.

Default batch sizes (unchanged behaviour when `setBatchSize` is not called):

| Active configuration | Default |
|---|---|
| `propFilter: InstanceKey` | 100 |
| `propFilter: BisCoreElement` | 20 |
| `propFilter: All`, `abbreviateBlobs: false` | 5 |
| `propFilter: All` (blobs abbreviated or unset) | 10 |

The `All` filter default is reduced from 20 to **10** in this release. When `propFilter` is `All`, the reader fetches every EC property across all tables that the instance maps to — row payloads are substantially heavier than `BisCoreElement` (which is limited to base element columns only). The lower default keeps peak memory usage in the same ballpark as `BisCoreElement` when processing the same changeset. Callers that need maximum throughput and can tolerate higher memory usage can restore the previous behavior with `reader.setBatchSize(20)`.

```ts
using reader = ChangesetReader.openFile({ db, fileName: changeset.pathname });
reader.setBatchSize(10);
while (reader.step()) { /* ... */ }
```

## @itwin/map-layers-formats

### Azure Maps basemap support is available through map-layers-formats

`@itwin/map-layers-formats` now registers Azure Maps imagery support through `MapLayersFormats.initialize()` and exposes a beta `AzureMaps` helper for applying Azure Maps Street, Aerial, and Hybrid basemaps.

Applications configure the Azure Maps key when initializing `@itwin/map-layers-formats` with `MapLayersFormats.initialize({ azureMapsOpts: { subscriptionKey: ... } })`. After initializing `@itwin/map-layers-formats`, code that wants Azure-specific basemap helpers can import `AzureMaps` from that package.

## @itwin/build-tools

### `mocha` is now an optional peer dependency

`@itwin/build-tools` no longer declares `mocha` as a direct dependency. It is now an optional [peer dependency](https://nodejs.org/en/blog/npm/peer-dependencies), because the only part of the package that uses `mocha` is the `mocha-reporter` (`BentleyMochaReporter`), which always runs inside a consumer that is already executing `mocha`.

This removes `mocha` — and its vulnerable transitive dependencies such as `serialize-javascript` and `diff` — from the *direct* dependency closure of `@itwin/build-tools`. Consumers that do not use the reporter (and therefore do not run `mocha`) no longer pull `mocha` in through `@itwin/build-tools`, so it stops surfacing in their audits under pnpm and yarn. Note that `@itwin/build-tools` still depends on `mocha-junit-reporter`, which declares a required peer dependency on `mocha`; package managers that auto-install required peers (such as npm v7+) may therefore still resolve `mocha` transitively.

If you consume the reporter via `@itwin/build-tools/mocha-reporter`, declare `mocha` in your own package's `devDependencies` (most packages running mocha already do):

```json
{
  "devDependencies": {
    "mocha": "^11.1.0"
  }
}
```

Packages that do not use the `mocha-reporter` are unaffected, and the optional peer dependency itself produces no installation warnings when `mocha` is absent under pnpm and yarn.
