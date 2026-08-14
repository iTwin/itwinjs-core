---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-common](#itwincore-common)
    - [QueryBinder.bindIdSet now throws on invalid ids](#querybinderbindidset-now-throws-on-invalid-ids)
  - [@itwin/core-backend](#itwincore-backend)
    - [Edit from element, model, and aspect callbacks](#edit-from-element-model-and-aspect-callbacks)
    - [WorkspaceDb file resource APIs deprecated](#workspacedb-file-resource-apis-deprecated)
    - [Stream element aspects for multiple elements](#stream-element-aspects-for-multiple-elements)
    - [Quantity formatting for text annotation fields](#quantity-formatting-for-text-annotation-fields)
      - [Configuring a FieldRun](#configuring-a-fieldrun)
      - [Format resolution](#format-resolution)
      - [Async evaluation](#async-evaluation)
      - [Opting in to synchronous formatting](#opting-in-to-synchronous-formatting)
  - [@itwin/core-common](#itwincore-common-1)
    - [Rank support for DefinitionSet](#rank-support-for-definitionset)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Invalidate decorations when element visibility changes](#invalidate-decorations-when-element-visibility-changes)
  - [@itwin/core-geometry](#itwincore-geometry)
    - [Simplifying filleted line strings](#simplifying-filleted-line-strings)

## @itwin/core-common

### QueryBinder.bindIdSet now throws on invalid ids

[QueryBinder.bindIdSet]($common) previously silently ignored string entries that are not valid [Id64String]($bentley)s (for example `"50"` or `""`) during id compression. It now throws a descriptive [ITwinError]($bentley) instead, identifiable via `ITwinError.isError(error, "itwin-QueryBinder", "invalid-arguments")`, so callers can catch and diagnose the invalid entry rather than having it silently dropped.

**Note:** `bindIdSet` still expects entries typed as `Id64String`. Callers binding ids from untyped or nullable query data (for example a nullable column via [ECSqlReader]($common)) should filter out non-string/`null`/`undefined` values before calling `bindIdSet`, as such entries remain outside the documented contract and are not guaranteed to produce this descriptive error.

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

[FieldRun]($common)s whose target property resolves to a `"quantity"` or `"coordinate"` value can now be rendered through the standard iTwin.js quantity formatting pipeline instead of the previous placeholder `toString()` representation.

Formatting stays on the backend (text layout is a backend concern) and is available via two entry points: an **async** entry point that runs the full pipeline on demand, and an opt-in **synchronous** entry point that a host can register a pre-warmed provider for so field values format inside the `TxnManager` update callbacks.

#### Configuring a FieldRun

Field-level formatting is configured via a new [QuantityFieldFormatOptions]($common) block on [FieldFormatOptions]($common):

```typescript
const fieldRun = FieldRun.create({
  propertyHost: { elementId, schemaName: "MyDomain", className: "Widget" },
  propertyPath: { propertyName: "length" },
  formatOptions: {
    quantity: {
      // Look up a specific KindOfQuantity via the active FormatsProvider,
      // overriding the property's own KoQ.
      kindOfQuantity: "AecUnits.LENGTH",
      // Optionally scope resolution to a specific registered FormatSet on
      // the synchronous path (see below).
      formatSet: myFormatSetId,
    },
  },
});
```

`kindOfQuantity` and `persistenceUnit` are **independent** overrides: setting one falls through to the property side for the other. This lets a caller pin the presentation (via `kindOfQuantity`) while still reading the persistence unit from the EC property, or vice versa.

#### Format resolution

For each `"quantity"` or `"coordinate"` field the formatter looks up a [FormatterSpec]($core-quantity) by (KindOfQuantity name, persistence unit name) pair, in this order:

1. **Effective override pair.** `formatOptions.quantity.kindOfQuantity ?? propertyKindOfQuantity` for the name, `formatOptions.quantity.persistenceUnit ?? propertyPersistenceUnit` for the unit.
2. **Property-side pair.** `(propertyKindOfQuantity, propertyPersistenceUnit)` — skipped when identical to the effective pair.

The first pair whose format-props lookup **and** persistence-unit lookup both succeed in the active provider wins. If none succeeds, `"quantity"` and `"coordinate"` fields fall back to their raw string representation (`value.toString()` for `"quantity"`, a `(x, y[, z])` tuple for `"coordinate"`).

Core does not carry a built-in coordinate format: coordinate presentation is application policy and belongs to the FormatsProvider / FormatSet supplied by the host. Coordinate values whose EC property has no KindOfQuantity require the caller to declare **both** `kindOfQuantity` and `persistenceUnit` in `formatOptions.quantity` for an override to take effect — Core does not synthesize a persistence unit from the [BIS geometry meters convention](../bis/guide/other-topics/units.md). Callers that want that convention should pass `Units.LENGTH.M` (from `@itwin/core-quantity`) explicitly.

#### Async evaluation

Because [FormatterSpec]($core-quantity) creation is asynchronous, the primary entry point is [ElementDrivesTextAnnotation.evaluateFieldsAsync]($backend). It updates the [FieldRun.cachedContent]($common) of every field in the supplied [TextBlock]($common) in memory:

```typescript
const numUpdated = await ElementDrivesTextAnnotation.evaluateFieldsAsync({ iModel, block });
```

By default the formatter uses a [SchemaFormatsProvider]($core-quantity) built from the iModel's schema context. Applications that own a [FormatsProvider]($core-quantity) — for example a FormatSet-backed provider — can route formatting through it by supplying it as a sibling of `iModel` / `block`:

```typescript
const numUpdated = await ElementDrivesTextAnnotation.evaluateFieldsAsync({
  iModel,
  block,
  formatsProvider: myFormatsProvider,
  // unitsProvider omitted -> defaults to the iModel's schema-backed units provider
});
```

`evaluateFieldsAsync` mutates the in-memory `TextBlock`; **it does not persist**. Callers that want the formatted output to survive the session must assign the updated block back to the owning element (for example via `TextAnnotation2d.setAnnotation` / `TextAnnotation3d.setAnnotation`) and call `element.update()` inside a transaction.

An injected `formatsProvider` / `unitsProvider` applies **block-wide** — every `"quantity"` and `"coordinate"` field in `block` is resolved through it regardless of the field's `formatOptions.quantity.formatSet`. This intentionally differs from the [synchronous path](#opting-in-to-synchronous-formatting) below, where routing is per-field and only fields whose `formatSet` matches a registration format through a provider. A block that mixes tagged and untagged fields will render different strings on the two paths when a caller registers a sync provider under one `formatSet` while passing a distinct block-wide provider to `evaluateFieldsAsync`; callers needing per-field routing on the async path must slice their block and call `evaluateFieldsAsync` once per provider.

#### Opting in to synchronous formatting

The synchronous [ElementDrivesTextAnnotation.evaluateFields]($backend) and the `TxnManager` field-update callbacks render `"quantity"` and `"coordinate"` fields as their raw string representation **unless** the host registers a pre-warmed [FormattingSpecProvider]($core-quantity) keyed by [FormatSet]($core-quantity) [Id64String]($bentley). Sync formatting only fires for fields whose `formatOptions.quantity.formatSet` matches a registered id.

```typescript
iModel.onBeforeClose.addOnce(() => {
  ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(formatSetId);
});
ElementDrivesTextAnnotation.registerFieldFormattingProvider({ formatSet: formatSetId, provider });
```

Hosts can pre-compute the required `(KindOfQuantity, persistenceUnit)` pairs for a given `TextBlock` via [ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend) and warm their provider's cache before insert / update so the txn callback finds every spec it needs.

Registrations are **process-wide** — Core does not scope them to any [IModelDb]($backend), and never sweeps entries automatically. Hosts own the lifetime contract: register when the iModel that provides the FormatSet opens, and call [ElementDrivesTextAnnotation.unregisterFieldFormattingProvider]($backend) when it closes. Failing to unregister leaves a stale entry that a subsequent iModel carrying the same FormatSet id may silently consume. Registering a provider does **not** reformat existing annotations — hosts that need to refresh already-persisted `cachedContent` must re-evaluate the affected blocks explicitly. Symmetrically, unregistering a provider that saved annotations depend on causes the next source-element edit to overwrite their formatted `cachedContent` with the raw string representation; hosts that need formatted output to survive across a provider gap should keep the provider registered for the lifetime of the annotations that depend on it.

## @itwin/core-common

### Rank support for DefinitionSet

[BisCore:DefinitionSet]($docs/bis/domains/BisCore.ecschema.md) (the base class of [DefinitionContainer]($backend) and [DefinitionGroup]($backend)) has a `Rank` property, but the iTwin.js API had no counterpart for it - `Rank` was only exposed for [Category]($backend)/[SubCategory]($backend). The new `@beta` [DefinitionSetProps.rank]($common) property (and the corresponding [DefinitionSet.rank]($backend) member) close that gap, using the same [Rank]($common) enum already used by `CategoryProps.rank`. `rank` is persisted when inserting or updating a `DefinitionContainer` or `DefinitionGroup`, and is read back correctly through [IModelDb.Elements.getElementProps]($backend) and [DefinitionSet.toJSON]($backend).

## @itwin/core-frontend

### Invalidate decorations when element visibility changes

[ViewportDecorator]($frontend)s often produce decoration graphics associated with elements in the scene. Such graphics should be updated if the visibility of the associated element changes. For example, a measurement tool might draw a label near a pipe indicating its length. The label should disappear if the user hides the pipe. To facilitate this, all cached decorations (produced and reused when [ViewportDecorator.useCachedDecorations]($frontend) is `true`) are now recreated in response to potential changes to the visibility of elements in a viewport, including modification of the sets of always- and never-drawn elements, displayed categories and subcategories, and feature symbology overrides.

## @itwin/core-geometry

### Simplifying filleted line strings

The [CurveFactory.createFilletsInLineString]($core-geometry) options bundle [CreateFilletsInLineStringOptions]($core-geometry) has a new optional property `CreateFilletsInLineStringOptions.simplifyPath` defaulting to `false`. When set to `true`, the output [Path]($core-geometry) is simplified by removing small segments less than the `CreateFilletsInLineStringOptions.closureTolerance` in length, and by merging adjacent arcs where possible. This is particularly helpful in cleaning up an output `Path` containing fillets that entirely consume an input line string edge (or nearly so).
