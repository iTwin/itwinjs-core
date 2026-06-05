---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Configurable precision for graphical editing at high coordinates](#configurable-precision-for-graphical-editing-at-high-coordinates)
  - [@itwin/map-layers-formats](#itwinmap-layers-formats)
    - [Azure Maps basemap support is available through map-layers-formats](#azure-maps-basemap-support-is-available-through-map-layers-formats)

## @itwin/core-frontend

### Configurable precision for graphical editing at high coordinates

During a [GraphicalEditingScope]($frontend), graphics for modified elements that are georeferenced far from the coordinate system origin could exhibit float32 precision artifacts such as jagged curves. The new [GraphicalEditingScope.dynamicGraphicsAbsolutePositionThreshold]($frontend) property sets the world-space coordinate magnitude (in meters) beyond which such graphics use `rtcCenter` centering to preserve precision, at a small performance cost. It defaults to 10 kilometers.

```ts
const scope = await briefcase.enterEditingScope();
scope.dynamicGraphicsAbsolutePositionThreshold = 50_000;
```

## @itwin/map-layers-formats

### Azure Maps basemap support is available through map-layers-formats

`@itwin/map-layers-formats` now registers Azure Maps imagery support through `MapLayersFormats.initialize()` and exposes a beta `AzureMaps` helper for applying Azure Maps Street, Aerial, and Hybrid basemaps.

Applications configure the Azure Maps key when initializing `@itwin/map-layers-formats` with `MapLayersFormats.initialize({ azureMapsOpts: { subscriptionKey: ... } })`. After initializing `@itwin/map-layers-formats`, code that wants Azure-specific basemap helpers can import `AzureMaps` from that package.
