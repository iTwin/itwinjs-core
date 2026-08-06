---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-bentley](#itwincore-bentley)
    - [`CompressedId64Set.isValid` type guard](#compressedid64setisvalid-type-guard)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Pluggable Cesium Ion authentication via `CesiumAccessClient`](#pluggable-cesium-ion-authentication-via-cesiumaccessclient)
    - [Configurable precision for graphical editing at high coordinates](#configurable-precision-for-graphical-editing-at-high-coordinates)
    - [`IModelConnection.createQueryReader` now terminates gracefully if the connection is closed](#imodelconnectioncreatequeryreader-now-terminates-gracefully-if-the-connection-is-closed)
    - [Reality model tiles with JSON glTF content now render](#reality-model-tiles-with-json-gltf-content-now-render)
    - [Quantity property description classes deprecated](#quantity-property-description-classes-deprecated)
    - [Bing Maps deprecation and new geospatial provider interfaces](#bing-maps-deprecation-and-new-geospatial-provider-interfaces)
      - [What's new](#whats-new)
      - [What's deprecated](#whats-deprecated)
    - [Graphics no longer disappear when a new category is inserted](#graphics-no-longer-disappear-when-a-new-category-is-inserted)
  - [@itwin/core-backend](#itwincore-backend)
    - [Quantity formatting for text annotation fields](#quantity-formatting-for-text-annotation-fields)
    - [Stream element aspects for multiple elements](#stream-element-aspects-for-multiple-elements)
    - [Edit from element, model, and aspect callbacks](#edit-from-element-model-and-aspect-callbacks)
    - [WorkspaceDb file resource APIs deprecated](#workspacedb-file-resource-apis-deprecated)
  - [@itwin/geometry](#itwingeometry)
    - [Simplifying filleted line strings](#simplifying-filleted-line-strings)

## @itwin/core-bentley

### `CompressedId64Set.isValid` type guard

[CompressedId64Set.isValid]($bentley) is a new type guard that returns `true` if a value is a valid `CompressedId64Set` — either an empty string (representing an empty set) or a non-empty string beginning with `"+"`. This lets callers safely distinguish a compressed Id set from a plain [Id64String]($bentley) or any other value without duplicating the internal format heuristic:

```typescript
function processIds(ids: unknown): void {
  if (CompressedId64Set.isValid(ids)) {
    for (const id of CompressedId64Set.iterable(ids))
      doSomething(id);
  } else if (typeof ids === "string" && Id64.isValidId64(ids)) {
    doSomething(ids);
  }
}
```

## @itwin/core-frontend

### Pluggable Cesium Ion authentication via `CesiumAccessClient`

A new [CesiumAccessClient]($frontend) interface and [TileAdmin.Props.cesiumAccess]($frontend) option let apps plug in a custom Cesium asset resolver (such as the [iTwin Platform Cesium Curated Content API](https://developer.bentley.com/apis/cesium-curated-content/overview/)) without requiring a personal Cesium Ion subscription or adding a platform dependency to `@itwin/core-frontend`.

Two authentication paths coexist:

| Path | When to use | How to configure |
| --- | --- | --- |
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

## @itwin/core-backend

### Quantity formatting for text annotation fields

[FieldRun]($common)s whose target property resolves to a `"quantity"` or `"coordinate"` value can now be rendered through the standard iTwin.js quantity formatting pipeline instead of the previous placeholder `toString()` representation. Field-level formatting is configured via a new [QuantityFieldFormatOptions]($common) block on [FieldFormatOptions]($common):

```typescript
const fieldRun = FieldRun.create({
  propertyHost: { elementId, schemaName: "MyDomain", className: "Widget" },
  propertyPath: { propertyName: "length" },
  formatOptions: {
    quantity: {
      // Look up a specific KindOfQuantity via the active FormatsProvider, overriding
      // the property's own KoQ.
      kindOfQuantity: "AecUnits.LENGTH",
    },
  },
});
```

A format is resolved in this priority order:

1. `formatOptions.quantity.kindOfQuantity` — a full KindOfQuantity name looked up via the active [FormatsProvider]($core-quantity).
2. The property's own [KindOfQuantity]($ecschema-metadata).
3. For `"coordinate"` only, a built-in meters fallback.

Because [FormatterSpec]($core-quantity) creation is asynchronous, quantity formatting is only applied when a field is evaluated through the new async entry point [ElementDrivesTextAnnotation.evaluateFieldsAsync]($backend):

```typescript
const numUpdated = await ElementDrivesTextAnnotation.evaluateFieldsAsync({ iModel, block });
```

Applications that own a [FormatsProvider]($core-quantity) (for example a FormatSet-backed provider from Drawing Production) can route formatting through it by supplying [FieldFormattingProviders]($backend):

```typescript
const numUpdated = await ElementDrivesTextAnnotation.evaluateFieldsAsync({
  iModel,
  block,
  formatting: {
    formatsProvider: myFormatsProvider, // e.g. Drawing Production's FormatSet-backed provider
    // unitsProvider omitted -> defaults to the iModel's schema-backed units provider
  },
});
```

The existing synchronous [ElementDrivesTextAnnotation.evaluateFields]($backend) and the `TxnManager` field-update callbacks continue to render `"quantity"` and `"coordinate"` fields as their raw string representation for backward compatibility. Applications that want formatted quantity output for text annotations should migrate their evaluation calls to the async variant.

### Stream element aspects for multiple elements

Use [IModelDb.Elements.queryAspects]($backend) to read the [ElementAspect]($backend) instances owned by a set of elements. The method queries all supplied element Ids together and returns an async iterator, so callers can process each aspect without buffering the complete result set.

Use this method for batch processing, such as exporters and transformers, where calling [IModelDb.Elements.getAspects]($backend) once per element would issue many separate queries. Continue to use `getAspects` when reading a small result from one element and a synchronous array is more convenient.

The options support the same polymorphic `aspectClassFullName` filter as `getAspects`, exact class exclusions, and owner-grouped results. Set `usePrimaryConn` when the query must include uncommitted aspects from an active edit transaction.

[[include:CoreBackend.IModelDb.QueryAspects]]

### Edit from element, model, and aspect callbacks

A new beta API, [IModelDb.getIndirectTxn]($backend), provides the [EditTxn]($backend) associated with an element, model, or aspect callback. Callbacks whose arguments provide an [IModelDb]($backend) but no transaction can use it to perform additional edits within the transaction that invoked the callback.

```ts
[[include:EditTxn.ElementCallback]]
```

The operation that invoked the callback owns the returned transaction. The callback must not start, end, save, abandon, or otherwise manage the transaction lifecycle. Callbacks that receive `indirectEditTxn` directly should continue using that property.

### WorkspaceDb file resource APIs deprecated

The [WorkspaceDb.getFile]($backend), [EditableWorkspaceDb.addFile]($backend), [EditableWorkspaceDb.updateFile]($backend), and [EditableWorkspaceDb.removeFile]($backend) APIs are deprecated. Store binary resources with [EditableWorkspaceDb.addBlob]($backend), or text resources with [EditableWorkspaceDb.addString]($backend), so applications can read their contents directly from the [WorkspaceDb]($backend).

```ts
// Before
editableDb.addFile("equipment-data", localFileName);
const extractedFileName = workspaceDb.getFile("equipment-data");

// After
editableDb.addBlob("equipment-data", fs.readFileSync(localFileName));
const contents = workspaceDb.getBlob("equipment-data");
```

The deprecated methods remain functional so existing file resources can be read, replaced, migrated, or removed. If still using `addFile()`, new file extensions now reject characters that are invalid in cross-platform filenames, and existing resources with unsafe extension metadata use an extensionless generated cache filename.

## @itwin/geometry

### Simplifying filleted line strings

The [CurveFactory.createFilletsInLineString]($core-geometry) options bundle [CreateFilletsInLineStringOptions]($core-geometry) has a new optional property `CreateFilletsInLineStringOptions.simplifyPath` defaulting to `false`. When set to `true`, the output [Path]($core-geometry) is simplified by removing small segments less than the `CreateFilletsInLineStringOptions.closureTolerance` in length, and by merging adjacent arcs where possible. This is particularly helpful in cleaning up an output `Path` containing fillets that entirely consume an input line string edge (or nearly so).
