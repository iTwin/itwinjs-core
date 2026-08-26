---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-common](#itwincore-common)
    - [QueryBinder.bindIdSet now throws on invalid ids](#querybinderbindidset-now-throws-on-invalid-ids)
    - [Class metadata in transaction change events](#class-metadata-in-transaction-change-events)
  - [@itwin/core-backend](#itwincore-backend)
    - [Reserving elements for concurrent creation](#reserving-elements-for-concurrent-creation)
    - [Edit from element, model, and aspect callbacks](#edit-from-element-model-and-aspect-callbacks)
    - [WorkspaceDb file resource APIs deprecated](#workspacedb-file-resource-apis-deprecated)
    - [Stream element aspects for multiple elements](#stream-element-aspects-for-multiple-elements)
    - [ECSQL `IS` / `IS NOT` operator now works between two operands](#ecsql-is--is-not-operator-now-works-between-two-operands)
    - [Quantity formatting for text annotation fields](#quantity-formatting-for-text-annotation-fields)
      - [Configuring a FieldRun](#configuring-a-fieldrun)
      - [Format resolution](#format-resolution)
      - [Adopting a FormatSet](#adopting-a-formatset)
        - [Deciding what to warm](#deciding-what-to-warm)
      - [Evaluating fields](#evaluating-fields)
  - [@itwin/core-common](#itwincore-common-1)
    - [Rank support for DefinitionSet](#rank-support-for-definitionset)
  - [@itwin/core-electron](#itwincore-electron)
    - [Late RPC responses are ignored during shutdown](#late-rpc-responses-are-ignored-during-shutdown)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Invalidate decorations when element visibility changes](#invalidate-decorations-when-element-visibility-changes)
    - [OPC point clouds without a vertical datum are now placed using orthometric heights](#opc-point-clouds-without-a-vertical-datum-are-now-placed-using-orthometric-heights)
    - [EmphasizeElements applies default appearance with no elements emphasized](#emphasizeelements-applies-default-appearance-with-no-elements-emphasized)
    - [Map-layer security hardening](#map-layer-security-hardening)
      - [Origin-restricted credentials (opt-in)](#origin-restricted-credentials-opt-in)
      - [Attribution and tooltip data are no longer rendered as HTML](#attribution-and-tooltip-data-are-no-longer-rendered-as-html)
  - [@itwin/core-geometry](#itwincore-geometry)
    - [Simplifying filleted line strings](#simplifying-filleted-line-strings)

## @itwin/core-common

### QueryBinder.bindIdSet now throws on invalid ids

[QueryBinder.bindIdSet]($common) previously silently ignored string entries that are not valid [Id64String]($bentley)s (for example `"50"` or `""`) during id compression. It now throws a descriptive [ITwinError]($bentley) instead, identifiable via `ITwinError.isError(error, "itwin-QueryBinder", "invalid-arguments")`, so callers can catch and diagnose the invalid entry rather than having it silently dropped.

**Note:** `bindIdSet` still expects entries typed as `Id64String`. Callers binding ids from untyped or nullable query data (for example a nullable column via [ECSqlReader]($common)) should filter out non-string/`null`/`undefined` values before calling `bindIdSet`, as such entries remain outside the documented contract and are not guaranteed to produce this descriptive error.

### Class metadata in transaction change events

The shared [TxnEntityMetadata]($common) contract is now exported from `@itwin/core-common` and used by both transaction event APIs. [TxnManager.onElementsChanged]($backend) and [TxnManager.onModelsChanged]($backend) expose [TxnChangedEntity.metadata]($backend) for each changed entity. Use `metadata.classFullName` to match an exact ECClass or `metadata.is("Schema:BaseClass")` to include derived classes without resolving class Ids asynchronously.

The frontend [BriefcaseTxns]($frontend) events continue to supply [TxnEntityChanges]($frontend), which has its own metadata and filtering API. The backend and frontend payloads describe the same transaction activity but are different types and should be documented and used separately.

The existing `TxnEntityMetadata` export from `@itwin/core-frontend` is deprecated; import [TxnEntityMetadata]($common) from `@itwin/core-common` instead.

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

### ECSQL `IS` / `IS NOT` operator now works between two operands

The ECSQL `IS` and `IS NOT` operators can now be used between two operands — for example `prop1 IS [NOT] prop2`, where each operand may be any value expression: a property, the `NULL` literal, a constant, a parameter, a function call, an arithmetic expression, etc. These map to SQLite's **null-safe** comparison operators, so `NULL IS NULL` is `TRUE` and `1 IS NULL` is `FALSE`, unlike `=`/`<>` which treat a `NULL` operand as _unknown_.

Previously `IS` / `IS NOT` only supported the right-hand operands `NULL`, the boolean literals `TRUE`/`FALSE`/`UNKNOWN`, and the [ECClass type predicate](../learning/ECSqlReference/ECClassFilter.md) (`IS (ClassName)`). Those forms still take precedence — a right-hand operand that is exactly `NULL`/`TRUE`/`FALSE`/`UNKNOWN`, or a parenthesized **qualified** class name such as `(bis.Element)` (optionally with an `ONLY`/`ALL` prefix or a comma-separated list), keeps its original meaning. A parenthesized _unqualified_ name such as `(prop2)` is instead read as a value expression, so `prop1 IS (prop2)` is a null-safe comparison. A parenthesized _qualified_ name that does not resolve to a known ECClass — for example `(alias.prop)` or `(ts.Status.Active)` — is also treated as a null-safe value expression instead of failing with a "class not found" error; when a qualified name is both a valid class and a valid property path, the type-predicate (class) reading takes precedence.

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
2. **Property-side pair.** `(propertyKindOfQuantity, propertyPersistenceUnit)` — skipped when identical to the effective pair, and skipped entirely when `persistenceUnit` names a *different* unit than the property's own (see below).

The first pair whose format-props lookup **and** persistence-unit lookup both succeed in the active provider wins. If none succeeds, `"quantity"` and `"coordinate"` fields fall back to their raw string representation (`value.toString()` for `"quantity"`, a `(x, y[, z])` tuple for `"coordinate"`).

The property-side fallback is a **presentation** fallback only. `kindOfQuantity` chooses how a magnitude is displayed, so falling back to the property's KoQ yields a different-looking but still correct number. `persistenceUnit` is a statement about what the stored magnitude *means*: a field declaring `persistenceUnit: "Units.FT"` asserts that the `2.5` stored on the property is 2.5 feet. Formatting that `2.5` through the property's metre-based pair would render `"2.5 m"` — a plausible-looking, durable value off by the conversion factor, with nothing to signal the substitution. So when `persistenceUnit` disagrees with the property's persistence unit, there is no fallback: either the requested pair is pre-warmed, or the field renders raw and the shortfall appears on [FieldFormattingSpecProvider.misses]($backend). A `persistenceUnit` that merely restates the property's own unit, or is omitted entirely, leaves the fallback in place.

This is worth knowing when deciding what to pre-warm: a field carrying a `persistenceUnit` override is the one case where a warm-up gap cannot be papered over by the schema, so field-derived requirements ([ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend)) are mandatory for those fields — [FieldFormattingSpecProvider.collectSchemaFormattingRequirements]($backend) cannot see a unit no property declares.

Core does not carry a built-in coordinate format: coordinate presentation is application policy and belongs to the FormatsProvider / FormatSet supplied by the host. Coordinate values whose EC property has no KindOfQuantity require the caller to declare **both** `kindOfQuantity` and `persistenceUnit` in `formatOptions.quantity` for an override to take effect — Core does not synthesize a persistence unit from the [BIS geometry meters convention](../bis/guide/other-topics/units.md). Callers that want that convention should pass `Units.LENGTH.M` (from `@itwin/core-quantity`) explicitly.

The same rule applies to a field that indexes into a string property holding serialized JSON (for example `JsonProperties`). A numeric leaf is treated as a `"quantity"`, but it has no EC property behind it and therefore no property-side pair to fall through to — so declare **both** `kindOfQuantity` and `persistenceUnit` to have it formatted. Declaring one or neither is harmless: the field renders its raw value, exactly as it would have without a quantity type. A JSON `null` resolves to no value at all, so the field displays its invalid-content indicator rather than a stringified null.

#### Adopting a FormatSet

Register the FormatSet your application has adopted for an iModel, **when the iModel opens**. Registration is asynchronous: it pre-warms a [FormatterSpec]($core-quantity) for every field requirement it can find, so that subsequent evaluation needs no `await`.

```typescript
const provider = await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
  iModel,
  formatSet,
  requirements: FieldFormattingSpecProvider.collectSchemaFormattingRequirements(iModel),
});
iModel.onBeforeClose.addOnce(() => ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(iModel));
```

Registering at open matters because field evaluation fires from `TxnManager` callbacks on any source-element edit. An edit that lands before registration completes formats without the provider and persists a raw string, and — since registering does not walk existing annotations — that field is not revisited until the next edit to the same source.

##### Deciding what to warm

`requirements` is mandatory, and Core performs **no discovery of its own** — it never walks the iModel looking for annotations to warm. That decision belongs to the application, which already owns the FormatSets and knows which drawing, sheet or view is in scope in a way Core cannot. Three sources compose:

| Source | Answers | Cost |
| --- | --- | --- |
| [FieldFormattingSpecProvider.collectSchemaFormattingRequirements]($backend) | every KindOfQuantity the iModel's schemas declare | two metadata queries; independent of model size |
| [ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend) | one `TextBlock`, deduplicated | proportional to that block |
| [ElementDrivesTextAnnotation.getFieldFormattingRequirements]($backend) | one `FieldRun` | negligible |

`collectSchemaFormattingRequirements` is a sensible floor because its cost is bounded by the schemas rather than the data. It is **not** sufficient on its own: it sees only pairs a _property_ declares, so it cannot see a field whose `formatOptions.quantity.persistenceUnit` overrides that unit, nor a `"coordinate"` or no-KindOfQuantity field where both halves of the key come from the field's own overrides. Leaving those unwarmed is not a cosmetic shortfall — evaluation resolves the property's pair instead and scales the value by the wrong unit.

Applications that allow such overrides should also gather requirements from the annotations themselves. Because the overrides are persisted under their public property names, a targeted query finds the ones that need attention without loading every annotation:

```typescript
// Pass 1: the two built-in classes carry TextAnnotationData, so the substring test runs inside
// SQLite and non-overriding annotations never reach JavaScript.
const sql = `
  SELECT ECInstanceId FROM BisCore.TextAnnotation2d
    WHERE TextAnnotationData LIKE '%"kindOfQuantity"%' OR TextAnnotationData LIKE '%"persistenceUnit"%'
  UNION ALL
  SELECT ECInstanceId FROM BisCore.TextAnnotation3d
    WHERE TextAnnotationData LIKE '%"kindOfQuantity"%' OR TextAnnotationData LIKE '%"persistenceUnit"%'`;
```

Note that `BisCore.ITextAnnotation` is a mixin and does **not** carry `TextAnnotationData`, so it cannot be filtered this way. Applications with their own `ITextAnnotation` implementations need a second pass over those classes, excluding the two built-ins already covered. Getting either pass wrong yields _zero rows_, which is indistinguishable from "this iModel has no overrides" — so treat [FieldFormattingSpecProvider.misses]($backend) as the check that the requirement set was complete, not as an error report.

For each matched element, walk its blocks and accumulate:

```typescript
const requirements = ids.flatMap((id) =>
  iModel.elements.getElement<TextAnnotation2d>(id).getTextBlocks().flatMap((b) =>
    ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block: b.textBlock })));
```

A block authored later in the session may need a spec the initial warm-up never saw. Warm it before writing the annotation:

```typescript
await provider.warmUp(ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block }));
```

Most applications adopt exactly one FormatSet per iModel. To mix presentations within a single iModel — imperial callouts on an otherwise metric drawing, say — supply additional FormatSets, each paired with an application-chosen id, and have individual fields name one via `formatOptions.quantity.formatSet`:

```typescript
await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
  iModel,
  formatSet,                                      // applies to every field that names no other
  formatSets: [{ id: imperialFormatSetId, formatSet: imperialFormatSet }],
});
```

Generally speaking, the formatSet id should be the id of the FormatSet definition element, but as core does not enforce the definition element workflow, this is typed as a string.

This is still a **single** registration. One `FieldFormattingSpecProvider` holds every FormatSet the iModel uses — each is warmed into its own bucket, and fields select among them at evaluation time. There is no need to register once per FormatSet, and no need to swap providers to change which presentation a given field gets.

The `unitSystem` used to pick a KindOfQuantity's presentation format when its schema offers several defaults to the adopted FormatSet's own [FormatSet.unitSystem]($ecschema-metadata), or `"metric"` when no FormatSet is adopted. Override it with `unitSystem` on the same arguments.

Registrations are keyed by [IModelDb]($backend) and are **process-wide** — Core never sweeps them automatically, so unregister when the iModel closes. Provider lifetime is deliberately the application's to manage. Forgetting to unregister pins the iModel's [SchemaContext]($ecschema-metadata), and the closed `IModelDb` behind it, alive for the lifetime of the process; and although [IModel.key]($common) is a fresh GUID on each open by default, an application that supplies its own stable `key` when opening will find the stale registration again on reopen and format against a closed schema context. Registering a provider does **not** reformat existing annotations; applications that need to refresh already-persisted `cachedContent` must re-evaluate the affected blocks explicitly. Symmetrically, unregistering a provider that saved annotations depend on causes the next source-element edit to overwrite their formatted `cachedContent` with the raw string representation.

Keep a provider registered for as long as the annotations depending on it are editable. Note that this is only a concern when _no_ provider is registered: a registered provider whose FormatSet lacks an entry for a field's KindOfQuantity still falls back to that KoQ's presentation format from the iModel's schemas, so the field renders as `"2.5 m"` rather than `"2.5"`. Changing the adopted FormatSet needs only a second `registerFieldFormattingProvider` call — each registration replaces the prior one after its pre-warm completes, so there is no window in which the iModel has no provider. Unregistering first would create one.

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

### OPC point clouds without a vertical datum are now placed using orthometric heights

OPC point clouds whose CRS defines no vertical datum were displayed too high or low by the local geoid-ellipsoid separation, because their heights (conventionally orthometric, meaning measured against the geoid/mean sea level) were treated as ellipsoidal. Such heights are now interpreted as orthometric. If you previously applied a manual vertical offset to compensate for this fact, you may need to remove it.

### EmphasizeElements applies default appearance with no elements emphasized

[EmphasizeElements.addFeatureOverrides]($frontend) now applies [EmphasizeElements.defaultAppearance]($frontend) to de-emphasize all other elements even when no elements are currently emphasized or overridden. Previously, `defaultAppearance` only took effect if the always-drawn element set (established by [EmphasizeElements.emphasizeElements]($frontend) or [EmphasizeElements.isolateElements]($frontend)) was non-empty, so setting `defaultAppearance` directly - for example to de-emphasize the whole view when a tool has no elements to emphasize - had no visible effect. Note that `emphasizeElements` called with an empty set of Ids is still a no-op; use the `defaultAppearance` property setter directly for this scenario.

### Map-layer security hardening

#### Origin-restricted credentials (opt-in)

Map-layer imagery providers send credentials with any request they issue: the basic-auth credentials stored in [ImageMapLayerSettings]($common) are attached to every request URL, and an NTLM or Negotiate http 401 challenge from any server triggers a retry with browser credentials (i.e. SSO / Windows Authentication). Because map-layer URLs may come from user input or from URLs advertised in server capability documents, this can leak credentials to third-party hosts.

Applications can now opt in to restricting credentials to origins they trust:

```ts
IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://tiles.corp.example.com"];
```

The default is `false`, preserving the existing behavior; while disabled, each request sending credentials to an untrusted origin logs a warning once per origin, so applications can discover the origins they need to whitelist first. Applications — especially those relying on Kerberos / Windows Authentication for map servers — are encouraged to enable the restriction.

Both properties on [MapLayerFormatRegistry]($frontend) are `@beta`, as are the accompanying additions used to report blocked requests: the [MapLayerImageryProviderStatus]($frontend) and [MapLayerSourceStatus]($frontend) members `UntrustedOrigin`, and [MapLayerImageryProvider.blockedOrigins]($frontend).

Because `fetch` follows redirects transparently, a request can deliver browser credentials to an origin other than the one it targeted. While the restriction is enabled, SSO requests that include browser credentials are therefore issued with `redirect: "error"`: every redirect fails before its destination can be evaluated, including same-origin and allowlisted redirects. Applications whose trusted map servers redirect these requests should configure the layer or request to use the final endpoint directly and trust that origin, or disable the restriction if redirects are required. This redirect policy does not apply to caller-supplied Authorization headers or API tokens.

See [Map-layer security](../learning/frontend/MapLayersAndBasemaps.md#map-layer-security) for the full behavior, including redirect handling and how to react to blocked origins.

#### Attribution and tooltip data are no longer rendered as HTML

Attribution and copyright strings received from map servers (ArcGIS service metadata, Bing attribution service, Google Maps viewport info, Google Photorealistic 3D Tiles copyrights) were previously rendered using `innerHTML`, allowing a malicious or compromised server to inject markup or script into the viewport's logo cards and on-screen credits. These strings are now inserted as plain text; visual output is unchanged for legitimate attribution text. The same fix applies to reality-model tooltips (built from batch-table properties supplied by the tileset content), to user-supplied layer and model names shown in tooltips, and to ArcGIS identify results (field names and values shown in map tooltips), which are now HTML-escaped.

WMS `GetFeatureInfo` tooltips, which servers may deliberately format as markup, intentionally remain HTML — scoped to trusted origins when the origin restriction above is enabled.

The behavior of [IModelApp.makeLogoCard]($frontend) itself is unchanged: string `notice` values may still contain HTML. For untrusted text, use the new `noticeLines` option instead — its string entries are always rendered as plain text (never parsed as HTML) with standard logo-card styling, and an `HTMLElement` entry can be supplied for a line requiring markup.

## @itwin/core-geometry

### Simplifying filleted line strings

The [CurveFactory.createFilletsInLineString]($core-geometry) options bundle [CreateFilletsInLineStringOptions]($core-geometry) has a new optional property `CreateFilletsInLineStringOptions.simplifyPath` defaulting to `false`. When set to `true`, the output [Path]($core-geometry) is simplified by removing small segments less than the `CreateFilletsInLineStringOptions.closureTolerance` in length, and by merging adjacent arcs where possible. This is particularly helpful in cleaning up an output `Path` containing fillets that entirely consume an input line string edge (or nearly so).
