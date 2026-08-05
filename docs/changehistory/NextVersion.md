---
publish: false
---
# NextVersion

## Map Layers

### Custom request headers (API key header authentication)

Map layers can now attach custom HTTP headers to the requests they make, enabling authentication schemes that require a header such as an API key (for example `X-Api-Key` or `Authorization: Bearer …`). Previously only HTTP Basic credentials and query parameters were supported.

[ImageMapLayerSettings]($common) and [MapLayerSource]($frontend) each gain `savedHeaders` and `unsavedHeaders` properties, along with a `collectHeaders()` method that merges them (with `unsavedHeaders` taking precedence). The persisted [ImageMapLayerProps]($common) and [MapLayerSourceProps]($frontend) gain a corresponding `headers` field.

Headers provided in `unsavedHeaders` are never persisted to JSON, so secrets like API keys should always be supplied there. Headers in `savedHeaders` (or the `headers` prop) are persisted. The collected headers are applied both when validating a source and when requesting tiles for WMS, WMTS, ArcGIS, TileURL, OGC API Features, and ArcGIS Feature layers.

```ts
const source = MapLayerSource.fromJSON({ name: "Secured WMS", url, formatId: "WMS" });
// API key sent on every request but never written to the layer's JSON.
source.unsavedHeaders = { "X-Api-Key": "my-secret-key" };
const settings = source.toLayerSettings(subLayers);
```
