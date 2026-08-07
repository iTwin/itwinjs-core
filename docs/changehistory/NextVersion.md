---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Edit from element, model, and aspect callbacks](#edit-from-element-model-and-aspect-callbacks)
    - [WorkspaceDb file resource APIs deprecated](#workspacedb-file-resource-apis-deprecated)
    - [Stream element aspects for multiple elements](#stream-element-aspects-for-multiple-elements)
  - [@itwin/core-geometry](#itwincore-geometry)
    - [Simplifying filleted line strings](#simplifying-filleted-line-strings)
  - [Map Layers](#map-layers)
    - [Custom request headers (API key header authentication)](#custom-request-headers-api-key-header-authentication)

## @itwin/core-backend

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

### Stream element aspects for multiple elements

Use [IModelDb.Elements.queryAspects]($backend) to read the [ElementAspect]($backend) instances owned by a set of elements. The method queries all supplied element Ids together and returns an async iterator, so callers can process each aspect without buffering the complete result set.

Use this method for batch processing, such as exporters and transformers, where calling [IModelDb.Elements.getAspects]($backend) once per element would issue many separate queries. Continue to use `getAspects` when reading a small result from one element and a synchronous array is more convenient.

The options support the same polymorphic `aspectClassFullName` filter as `getAspects`, exact class exclusions, and owner-grouped results. Set `usePrimaryConn` when the query must include uncommitted aspects from an active edit transaction.

[[include:CoreBackend.IModelDb.QueryAspects]]

## @itwin/geometry

### Simplifying filleted line strings

The [CurveFactory.createFilletsInLineString]($core-geometry) options bundle [CreateFilletsInLineStringOptions]($core-geometry) has a new optional property `CreateFilletsInLineStringOptions.simplifyPath` defaulting to `false`. When set to `true`, the output [Path]($core-geometry) is simplified by removing small segments less than the `CreateFilletsInLineStringOptions.closureTolerance` in length, and by merging adjacent arcs where possible. This is particularly helpful in cleaning up an output `Path` containing fillets that entirely consume an input line string edge (or nearly so).

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
