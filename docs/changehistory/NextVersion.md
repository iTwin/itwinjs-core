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
    - [Bing Maps imagery is deprecated](#bing-maps-imagery-is-deprecated)
  - [@itwin/core-geometry](#itwincore-geometry)
    - [`CurveFactory.createFilletsInLineString` expanded options](#curve-factory-create-fillets-in-line-string-expanded-options)
  - [@itwin/map-layers-formats](#itwinmap-layers-formats)
    - [Azure Maps basemap support is available through map-layers-formats](#azure-maps-basemap-support-is-available-through-map-layers-formats)

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

### Bing Maps imagery is deprecated

Bing Maps imagery-specific APIs are now deprecated. This release does not change runtime behavior, and existing persisted Bing-backed styles continue to load for compatibility.

For new basemap imagery, prefer Azure Maps via `@itwin/map-layers-formats`.

> This imagery-only deprecation does not deprecate `BingLocationProvider` or `BingElevationProvider`, and it does not add a built-in replacement for Bing elevation or location services. Applications that continue using those Bing services must continue supplying `MapLayerOptions.BingMaps`. 

## @itwin/core-geometry

### `CurveFactory.createFilletsInLineString` expanded options

[CurveFactory.createFilletsInLineString]($core-geometry) has three new [CreateFilletsInLineStringOptions]($core-geometry) interface options to control the construction of the output `Path`, particularly with respect to the appearance of cusps in the output. A _cusp_ occurs when a fillet's radius is too large, and the arc consumes one or both adjacent line string edges. Cusps in the output of this method (especially large cusps) are generally considered to be undesirable.

[CreateFilletsInLineStringOptions.closureTolerance]($core-geometry) is used when [CreateFilletsInLineStringOptions.filletClosure]($core-geometry) is `true` to determine whether the final input point is to be considered equal to the first input point. If these points have distance less than `closureTolerance`, the final point is ignored when the input polygon is filleted. The default value of this option is [Geometry.smallMetricDistance]($core-geometry), matching previous behavior.

[CreateFilletsInLineStringOptions.cuspSegments]($core-geometry) is used when [CreateFilletsInLineStringOptions.allowCusp]($core-geometry) is `true` to insert a `LineSegment3d` in the output `Path` at each cusp. These extra `Path` children are retrograde line segments that bridge the gap formed by each cusp and thereby maintain the chain's continuity. To avoid these extra output segments, the caller can pass `cuspSegments = false` at the cost of chain discontinuity (if the gaps are small enough, they may be tolerated by chain processing downstream). The default value of this option is `true`, matching previous behavior.

[CreateFilletsInLineStringOptions.cuspTolerance]($core-geometry) is used when [CreateFilletsInLineStringOptions.allowCusp]($core-geometry) is `true` to determine whether to suppress large cusps in the output. A cusp segment whose length exceeds `cuspTolerance` will be eliminated in the output `Path` by the removal of one or both of its constituent fillet arcs. The default value of this option is [Geometry.smallMetricDistance]($core-geometry), which is a slight deviation from previous default behavior. The new default behavior allows only miniscule cusps, whereas the old default behavior allowed cusps of any size. The old default behavior is considered to be a bug.

## @itwin/map-layers-formats

### Azure Maps basemap support is available through map-layers-formats

`@itwin/map-layers-formats` now registers Azure Maps imagery support through `MapLayersFormats.initialize()` and exposes a beta `AzureMaps` helper for applying Azure Maps Street, Aerial, and Hybrid basemaps.

Applications configure the Azure Maps key when initializing `@itwin/map-layers-formats` with `MapLayersFormats.initialize({ azureMapsOpts: { subscriptionKey: ... } })`. After initializing `@itwin/map-layers-formats`, code that wants Azure-specific basemap helpers can import `AzureMaps` from that package.
