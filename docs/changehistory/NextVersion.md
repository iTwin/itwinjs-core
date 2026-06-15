---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [`IModelConnection.createQueryReader` now terminates gracefully if the connection is closed](#imodelconnectioncreatequeryreader-now-terminates-gracefully-if-the-connection-is-closed)
    - [Reality model tiles with JSON glTF content now render](#reality-model-tiles-with-json-gltf-content-now-render)
  - [@itwin/map-layers-formats](#itwinmap-layers-formats)
    - [Azure Maps basemap support is available through map-layers-formats](#azure-maps-basemap-support-is-available-through-map-layers-formats)

## @itwin/core-frontend

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

## @itwin/map-layers-formats

### Azure Maps basemap support is available through map-layers-formats

`@itwin/map-layers-formats` now registers Azure Maps imagery support through `MapLayersFormats.initialize()` and exposes a beta `AzureMaps` helper for applying Azure Maps Street, Aerial, and Hybrid basemaps.

Applications configure the Azure Maps key when initializing `@itwin/map-layers-formats` with `MapLayersFormats.initialize({ azureMapsOpts: { subscriptionKey: ... } })`. After initializing `@itwin/map-layers-formats`, code that wants Azure-specific basemap helpers can import `AzureMaps` from that package.
