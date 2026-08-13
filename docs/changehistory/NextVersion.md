---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Edit from element, model, and aspect callbacks](#edit-from-element-model-and-aspect-callbacks)
    - [WorkspaceDb file resource APIs deprecated](#workspacedb-file-resource-apis-deprecated)
    - [Stream element aspects for multiple elements](#stream-element-aspects-for-multiple-elements)
    - [Quantity formatting for text annotation fields](#quantity-formatting-for-text-annotation-fields)
  - [@itwin/geometry](#itwingeometry)
    - [Simplifying filleted line strings](#simplifying-filleted-line-strings)

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

If neither resolves in the active provider, `"quantity"` and `"coordinate"` fields fall back to their raw string representation. Core does not carry a built-in coordinate format: coordinate presentation is application policy and belongs to the FormatsProvider / FormatSet supplied by the host. Coordinate values whose EC property has no KindOfQuantity are still assumed to persist in meters (per [BIS geometry conventions](../bis/guide/other-topics/units.md)) so that a `kindOfQuantity` override can be looked up against `Units.LENGTH.M` without an explicit `persistenceUnit`.

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

### FormatSet-backed synchronous formatting

Hosts that need formatted quantity output from the synchronous [ElementDrivesTextAnnotation.evaluateFields]($backend) and `TxnManager` field-update paths can register a pre-warmed [FormattingSpecProvider]($core-quantity) keyed by FormatSet [Id64String]($bentley):

```typescript
iModel.onBeforeClose.addOnce(() => {
  ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(formatSetId);
});
ElementDrivesTextAnnotation.registerFieldFormattingProvider({ formatSet: formatSetId, provider });
```

Registrations are **process-wide** — Core does not scope them to any [IModelDb]($backend), and never sweeps entries automatically. Hosts own the lifetime contract: register when the iModel that provides the FormatSet opens, and call [ElementDrivesTextAnnotation.unregisterFieldFormattingProvider]($backend) when it closes. Failing to unregister leaves a stale entry that a subsequent iModel carrying the same FormatSet id may silently consume.

## @itwin/geometry

### Simplifying filleted line strings

The [CurveFactory.createFilletsInLineString]($core-geometry) options bundle [CreateFilletsInLineStringOptions]($core-geometry) has a new optional property `CreateFilletsInLineStringOptions.simplifyPath` defaulting to `false`. When set to `true`, the output [Path]($core-geometry) is simplified by removing small segments less than the `CreateFilletsInLineStringOptions.closureTolerance` in length, and by merging adjacent arcs where possible. This is particularly helpful in cleaning up an output `Path` containing fillets that entirely consume an input line string edge (or nearly so).
