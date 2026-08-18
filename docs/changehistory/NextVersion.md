---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-common](#itwincore-common)
    - [QueryBinder.bindIdSet now throws on invalid ids](#querybinderbindidset-now-throws-on-invalid-ids)
    - [Class metadata in transaction change events](#class-metadata-in-transaction-change-events)
  - [@itwin/core-backend](#itwincore-backend)
    - [Edit from element, model, and aspect callbacks](#edit-from-element-model-and-aspect-callbacks)
    - [WorkspaceDb file resource APIs deprecated](#workspacedb-file-resource-apis-deprecated)
    - [Stream element aspects for multiple elements](#stream-element-aspects-for-multiple-elements)
    - [ECSQL `IS` / `IS NOT` operator now works between two operands](#ecsql-is--is-not-operator-now-works-between-two-operands)
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

### Class metadata in transaction change events

The shared [TxnEntityMetadata]($common) contract is now exported from `@itwin/core-common` and used by both transaction event APIs. [TxnManager.onElementsChanged]($backend) and [TxnManager.onModelsChanged]($backend) expose [TxnChangedEntity.metadata]($backend) for each changed entity. Use `metadata.classFullName` to match an exact ECClass or `metadata.is("Schema:BaseClass")` to include derived classes without resolving class Ids asynchronously.

The frontend [BriefcaseTxns]($frontend) events continue to supply [TxnEntityChanges]($frontend), which has its own metadata and filtering API. The backend and frontend payloads describe the same transaction activity but are different types and should be documented and used separately.

The existing [TxnEntityMetadata]($frontend) export from `@itwin/core-frontend` is deprecated; import [TxnEntityMetadata]($common) from `@itwin/core-common` instead.

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

## @itwin/core-common

### Rank support for DefinitionSet

[BisCore:DefinitionSet]($docs/bis/domains/BisCore.ecschema.md) (the base class of [DefinitionContainer]($backend) and [DefinitionGroup]($backend)) has a `Rank` property, but the iTwin.js API had no counterpart for it - `Rank` was only exposed for [Category]($backend)/[SubCategory]($backend). The new `@beta` [DefinitionSetProps.rank]($common) property (and the corresponding [DefinitionSet.rank]($backend) member) close that gap, using the same [Rank]($common) enum already used by `CategoryProps.rank`. `rank` is persisted when inserting or updating a `DefinitionContainer` or `DefinitionGroup`, and is read back correctly through [IModelDb.Elements.getElementProps]($backend) and [DefinitionSet.toJSON]($backend).

## @itwin/core-frontend

### Invalidate decorations when element visibility changes

[ViewportDecorator]($frontend)s often produce decoration graphics associated with elements in the scene. Such graphics should be updated if the visibility of the associated element changes. For example, a measurement tool might draw a label near a pipe indicating its length. The label should disappear if the user hides the pipe. To facilitate this, all cached decorations (produced and reused when [ViewportDecorator.useCachedDecorations]($frontend) is `true`) are now recreated in response to potential changes to the visibility of elements in a viewport, including modification of the sets of always- and never-drawn elements, displayed categories and subcategories, and feature symbology overrides.

## @itwin/core-geometry

### Simplifying filleted line strings

The [CurveFactory.createFilletsInLineString]($core-geometry) options bundle [CreateFilletsInLineStringOptions]($core-geometry) has a new optional property `CreateFilletsInLineStringOptions.simplifyPath` defaulting to `false`. When set to `true`, the output [Path]($core-geometry) is simplified by removing small segments less than the `CreateFilletsInLineStringOptions.closureTolerance` in length, and by merging adjacent arcs where possible. This is particularly helpful in cleaning up an output `Path` containing fillets that entirely consume an input line string edge (or nearly so).
