---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Configurable precision for graphical editing at high coordinates](#configurable-precision-for-graphical-editing-at-high-coordinates)
    - [`IModelConnection.createQueryReader` now terminates gracefully if the connection is closed](#imodelconnectioncreatequeryreader-now-terminates-gracefully-if-the-connection-is-closed)
    - [Reality model tiles with JSON glTF content now render](#reality-model-tiles-with-json-gltf-content-now-render)
    - [Quantity property description classes deprecated](#quantity-property-description-classes-deprecated)
    - [Bing Maps deprecation and new geospatial provider interfaces](#bing-maps-deprecation-and-new-geospatial-provider-interfaces)
  - [@itwin/map-layers-formats](#itwinmap-layers-formats)
    - [Azure Maps basemap support is available through map-layers-formats](#azure-maps-basemap-support-is-available-through-map-layers-formats)
  - [@itwin/build-tools](#itwinbuild-tools)
    - [`mocha` is now an optional peer dependency](#mocha-is-now-an-optional-peer-dependency)

## @itwin/core-frontend

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
