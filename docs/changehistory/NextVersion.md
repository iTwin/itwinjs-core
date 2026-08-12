---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-common](#itwincore-common)
    - [QueryBinder.bindIdSet now throws on invalid ids](#querybinderbindidset-now-throws-on-invalid-ids)
  - [@itwin/core-backend](#itwincore-backend)
    - [Reserving elements for concurrent creation](#reserving-elements-for-concurrent-creation)
    - [Edit from element, model, and aspect callbacks](#edit-from-element-model-and-aspect-callbacks)
    - [WorkspaceDb file resource APIs deprecated](#workspacedb-file-resource-apis-deprecated)
    - [Stream element aspects for multiple elements](#stream-element-aspects-for-multiple-elements)
  - [@itwin/core-common](#itwincore-common)
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

### Reserving elements for concurrent creation

A new `@beta` synchronous coordination channel, [IModelDb.reservations]($backend), lets multiple briefcases concurrently create elements that share a stable identity without producing duplicate or conflicting elements once their changesets merge. It is the first of a planned family of [SynchronousChannel]($backend) coordination surfaces.

**Who is affected:** only iModels that have SchemaSync enabled. When SchemaSync is not enabled, [IModelDb.reservations]($backend) is a no-op and element inserts behave exactly as before — no action is required.

**New rule:** when SchemaSync is enabled and you are not holding the Schema Lock, **any element inserted with an explicitly-set `federationGuid` must first be reserved**. This covers shared definitions (e.g. categories, line styles) as well as the non-definition template elements contained in component recipes. Elements inserted without an explicit `federationGuid` are unaffected.

Reserve the elements you intend to create, then insert them normally:

```ts
await briefcase.reservations.reserveElements({
  elements: [{
    federationGuid: fedGuid,
    classFullName: SpatialCategory.classFullName,
    code: SpatialCategory.createCode(briefcase, IModel.dictionaryId, "Equipment"),
  }],
});

await briefcase.locks.acquireLocks({ shared: IModel.dictionaryId });
const categoryId = briefcase.elements.insertElement({
  classFullName: SpatialCategory.classFullName,
  model: IModel.dictionaryId,
  code: SpatialCategory.createCode(briefcase, IModel.dictionaryId, "Equipment"),
  federationGuid: fedGuid,
});
```

The insert resolves the reservation by `federationGuid`, uses the pre-reserved element id (so the element gets the same id in every briefcase), and verifies that the insert's class and Code match what was reserved.

**How to react:** if your app inserts elements with explicit `federationGuid`s, add a [SynchronousChannel.Reservations.reserveElements]($backend) call before the insert. An unreserved insert now throws an [ElementReservationError]($common) (`reservation-not-found`). Use [SynchronousChannel.Reservations.needsElementReservation]($backend) to check whether an element still needs reserving, and [ElementReservationError.isError]($common) to detect and classify failures. Inserting under the Schema Lock continues to bypass reservation checks, since it already serializes all briefcases. See [Concurrency Control](../learning/backend/ConcurrencyControl.md) for the full workflow.

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

## @itwin/core-common

### Rank support for DefinitionSet

[BisCore:DefinitionSet]($docs/bis/domains/BisCore.ecschema.md) (the base class of [DefinitionContainer]($backend) and [DefinitionGroup]($backend)) has a `Rank` property, but the iTwin.js API had no counterpart for it - `Rank` was only exposed for [Category]($backend)/[SubCategory]($backend). The new `@beta` [DefinitionSetProps.rank]($common) property (and the corresponding [DefinitionSet.rank]($backend) member) close that gap, using the same [Rank]($common) enum already used by `CategoryProps.rank`. `rank` is persisted when inserting or updating a `DefinitionContainer` or `DefinitionGroup`, and is read back correctly through [IModelDb.Elements.getElementProps]($backend) and [DefinitionSet.toJSON]($backend).

## @itwin/core-frontend

### Invalidate decorations when element visibility changes

[ViewportDecorator]($frontend)s often produce decoration graphics associated with elements in the scene. Such graphics should be updated if the visibility of the associated element changes. For example, a measurement tool might draw a label near a pipe indicating its length. The label should disappear if the user hides the pipe. To facilitate this, all cached decorations (produced and reused when [ViewportDecorator.useCachedDecorations]($frontend) is `true`) are now recreated in response to potential changes to the visibility of elements in a viewport, including modification of the sets of always- and never-drawn elements, displayed categories and subcategories, and feature symbology overrides.

## @itwin/core-geometry

### Simplifying filleted line strings

The [CurveFactory.createFilletsInLineString]($core-geometry) options bundle [CreateFilletsInLineStringOptions]($core-geometry) has a new optional property `CreateFilletsInLineStringOptions.simplifyPath` defaulting to `false`. When set to `true`, the output [Path]($core-geometry) is simplified by removing small segments less than the `CreateFilletsInLineStringOptions.closureTolerance` in length, and by merging adjacent arcs where possible. This is particularly helpful in cleaning up an output `Path` containing fillets that entirely consume an input line string edge (or nearly so).
