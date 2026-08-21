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
    - [ECSQL `IS` / `IS NOT` operator now works between two operands](#ecsql-is--is-not-operator-now-works-between-two-operands)
    - [Quantity formatting for text annotation fields](#quantity-formatting-for-text-annotation-fields)
      - [Configuring a FieldRun](#configuring-a-fieldrun)
      - [Format resolution](#format-resolution)
      - [Adopting a FormatSet](#adopting-a-formatset)
      - [Evaluating fields](#evaluating-fields)
  - [@itwin/core-common](#itwincore-common-1)
    - [Rank support for DefinitionSet](#rank-support-for-definitionset)
  - [@itwin/core-electron](#itwincore-electron)
    - [Late RPC responses are ignored during shutdown](#late-rpc-responses-are-ignored-during-shutdown)
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

### ECSQL `IS` / `IS NOT` operator now works between two operands

The ECSQL `IS` and `IS NOT` operators can now be used between two operands — for example `prop1 IS [NOT] prop2`, where each operand may be any value expression: a property, the `NULL` literal, a constant, a parameter, a function call, an arithmetic expression, etc. These map to SQLite's **null-safe** comparison operators, so `NULL IS NULL` is `TRUE` and `1 IS NULL` is `FALSE`, unlike `=`/`<>` which treat a `NULL` operand as _unknown_.

Previously `IS` / `IS NOT` only supported the right-hand operands `NULL`, the boolean literals `TRUE`/`FALSE`/`UNKNOWN`, and the [ECClass type predicate](../learning/ECSqlReference/ECClassFilter.md) (`IS (ClassName)`). Those forms still take precedence — a right-hand operand that is exactly `NULL`/`TRUE`/`FALSE`/`UNKNOWN`, or a parenthesized **qualified** class name such as `(bis.Element)` (optionally with an `ONLY`/`ALL` prefix or a comma-separated list), keeps its original meaning. A parenthesized *unqualified* name such as `(prop2)` is instead read as a value expression, so `prop1 IS (prop2)` is a null-safe comparison. A parenthesized *qualified* name that does not resolve to a known ECClass — for example `(alias.prop)` or `(ts.Status.Active)` — is also treated as a null-safe value expression instead of failing with a "class not found" error; when a qualified name is both a valid class and a valid property path, the type-predicate (class) reading takes precedence.

For multi-column operands (such as `Point2d`/`Point3d` and navigation properties) the comparison is expanded column-wise, consistent with `=` and `<>`: `IS` joins the per-column comparisons with `AND`, and `IS NOT` joins them with `OR`.

**Example** — find elements whose code value differs from their user label, or from a value extracted from JSON, treating `NULL` as a comparable value:

```sql
SELECT * FROM bis.Element WHERE CodeValue IS NOT UserLabel
SELECT * FROM bis.Element WHERE CodeValue IS json_extract(JsonProperties, '$.code')
```

See the [ECSQL operators reference](../learning/ECSqlReference/Operators.md#is--is-not-operator-null-safe-comparison) for more details.

### Quantity formatting for text annotation fields

[FieldRun]($common)s whose target property resolves to a `"quantity"` or `"coordinate"` value can now be rendered through the standard iTwin.js quantity formatting pipeline instead of the previous placeholder `toString()` representation.

Formatting stays on the backend (text layout is a backend concern). Field evaluation itself is **synchronous**, because it has to run inside the `TxnManager` update callbacks that recompute cached content when a source element changes. Everything asynchronous — resolving formats, loading units, building [FormatterSpec]($core-quantity)s — happens once, up front, when an application adopts a [FormatSet]($ecschema-metadata) for an iModel.

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

The same rule applies to a field that indexes into a string property holding serialized JSON (for example `JsonProperties`). A numeric leaf is treated as a `"quantity"`, but it has no EC property behind it and therefore no property-side pair to fall through to — so declare **both** `kindOfQuantity` and `persistenceUnit` to have it formatted. Declaring one or neither is harmless: the field renders its raw value, exactly as it would have without a quantity type. A JSON `null` resolves to no value at all, so the field displays its invalid-content indicator rather than a stringified null.

#### Adopting a FormatSet

Register the FormatSet your application has adopted for an iModel. Registration is asynchronous: it pre-warms a [FormatterSpec]($core-quantity) for every field requirement it can find, so that subsequent evaluation needs no `await`.

```typescript
const provider = await ElementDrivesTextAnnotation.registerFieldFormattingProvider({ iModel, formatSet });
iModel.onBeforeClose.addOnce(() => ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(iModel));
```

By default this sweeps the iModel for every dependency-tracked annotation and warms what they need. Applications that know their requirements — or that want to skip the sweep on a large iModel — can pass them explicitly, using [ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend) for an in-memory block or [ElementDrivesTextAnnotation.collectIModelFieldFormattingRequirements]($backend) for the persisted ones:

```typescript
await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
  iModel,
  formatSet,
  requirements: ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block }),
});
```

A block authored later in the session may need a spec the initial warm-up never saw. Warm it before writing the annotation:

```typescript
await provider.warmUp(ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block }));
```

Most applications adopt exactly one FormatSet per iModel. To mix presentations within a single iModel — imperial callouts on an otherwise metric drawing, say — supply additional FormatSets keyed by [Id64String]($bentley) and have individual fields name one via `formatOptions.quantity.formatSet`:

```typescript
await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
  iModel,
  formatSet,                                      // applies to every field that names no other
  formatSets: [{ id: imperialFormatSetId, formatSet: imperialFormatSet }],
});
```

The `unitSystem` used to pick a KindOfQuantity's presentation format when its schema offers several defaults to the adopted FormatSet's own [FormatSet.unitSystem]($ecschema-metadata), or `"metric"` when no FormatSet is adopted. Override it with `unitSystem` on the same arguments.

Registrations are keyed by [IModelDb]($backend) and are **process-wide** — Core never sweeps them automatically, so unregister when the iModel closes. Registering a provider does **not** reformat existing annotations; applications that need to refresh already-persisted `cachedContent` must re-evaluate the affected blocks explicitly. Symmetrically, unregistering a provider that saved annotations depend on causes the next source-element edit to overwrite their formatted `cachedContent` with the raw string representation.

#### Evaluating fields

[ElementDrivesTextAnnotation.evaluateFields]($backend) updates the [FieldRun.cachedContent]($common) of every field in the supplied [TextBlock]($common) and returns the number it changed:

```typescript
const numUpdated = ElementDrivesTextAnnotation.evaluateFields({ iModel, block });
```

It mutates the in-memory `TextBlock`; **it does not persist**. Callers that want the formatted output to survive the session must assign the updated block back to the owning element (for example via `TextAnnotation2d.setAnnotation` / `TextAnnotation3d.setAnnotation`) and call `element.update()` inside a transaction. The same evaluation runs automatically from the `TxnManager` field-update callbacks when a source element changes, which is why it cannot be asynchronous.

If a field needs a spec that was never warmed, it renders as its raw string representation and the shortfall is recorded on the provider. Applications can detect this, warm the gap, and re-evaluate:

```typescript
if (provider.misses.length > 0) {
  await provider.warmUp(provider.misses);
  provider.clearMisses();
  ElementDrivesTextAnnotation.evaluateFields({ iModel, block });
}
```

## @itwin/core-common

### Rank support for DefinitionSet

[BisCore:DefinitionSet]($docs/bis/domains/BisCore.ecschema.md) (the base class of [DefinitionContainer]($backend) and [DefinitionGroup]($backend)) has a `Rank` property, but the iTwin.js API had no counterpart for it - `Rank` was only exposed for [Category]($backend)/[SubCategory]($backend). The new `@beta` [DefinitionSetProps.rank]($common) property (and the corresponding [DefinitionSet.rank]($backend) member) close that gap, using the same [Rank]($common) enum already used by `CategoryProps.rank`. `rank` is persisted when inserting or updating a `DefinitionContainer` or `DefinitionGroup`, and is read back correctly through [IModelDb.Elements.getElementProps]($backend) and [DefinitionSet.toJSON]($backend).

## @itwin/core-electron

### Late RPC responses are ignored during shutdown

`ElectronApp.shutdown()` disposes any in-flight RPC requests. A response for one of those requests could still arrive from the backend afterwards, and the frontend transport would then dereference the missing request and throw, surfacing as an unhandled rejection while the application was tearing down. Such a response is now ignored instead.

Applications that shut down while requests are outstanding no longer need to filter these errors out of their shutdown paths.

## @itwin/core-frontend

### Invalidate decorations when element visibility changes

[ViewportDecorator]($frontend)s often produce decoration graphics associated with elements in the scene. Such graphics should be updated if the visibility of the associated element changes. For example, a measurement tool might draw a label near a pipe indicating its length. The label should disappear if the user hides the pipe. To facilitate this, all cached decorations (produced and reused when [ViewportDecorator.useCachedDecorations]($frontend) is `true`) are now recreated in response to potential changes to the visibility of elements in a viewport, including modification of the sets of always- and never-drawn elements, displayed categories and subcategories, and feature symbology overrides.

## @itwin/core-geometry

### Simplifying filleted line strings

The [CurveFactory.createFilletsInLineString]($core-geometry) options bundle [CreateFilletsInLineStringOptions]($core-geometry) has a new optional property `CreateFilletsInLineStringOptions.simplifyPath` defaulting to `false`. When set to `true`, the output [Path]($core-geometry) is simplified by removing small segments less than the `CreateFilletsInLineStringOptions.closureTolerance` in length, and by merging adjacent arcs where possible. This is particularly helpful in cleaning up an output `Path` containing fillets that entirely consume an input line string edge (or nearly so).
