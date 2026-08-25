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
    - [Bulk instance write API for ECDb](#bulk-instance-write-api-for-ecdb)
  - [@itwin/core-common](#itwincore-common)
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

Previously `IS` / `IS NOT` only supported the right-hand operands `NULL`, the boolean literals `TRUE`/`FALSE`/`UNKNOWN`, and the [ECClass type predicate](../learning/ECSqlReference/ECClassFilter.md) (`IS (ClassName)`). Those forms still take precedence — a right-hand operand that is exactly `NULL`/`TRUE`/`FALSE`/`UNKNOWN`, or a parenthesized **qualified** class name such as `(bis.Element)` (optionally with an `ONLY`/`ALL` prefix or a comma-separated list), keeps its original meaning. A parenthesized _unqualified_ name such as `(prop2)` is instead read as a value expression, so `prop1 IS (prop2)` is a null-safe comparison. A parenthesized _qualified_ name that does not resolve to a known ECClass — for example `(alias.prop)` or `(ts.Status.Active)` — is also treated as a null-safe value expression instead of failing with a "class not found" error; when a qualified name is both a valid class and a valid property path, the type-predicate (class) reading takes precedence.

For multi-column operands (such as `Point2d`/`Point3d` and navigation properties) the comparison is expanded column-wise, consistent with `=` and `<>`: `IS` joins the per-column comparisons with `AND`, and `IS NOT` joins them with `OR`.

**Example** — find elements whose code value differs from their user label, or from a value extracted from JSON, treating `NULL` as a comparable value:

```sql
SELECT * FROM bis.Element WHERE CodeValue IS NOT UserLabel
SELECT * FROM bis.Element WHERE CodeValue IS json_extract(JsonProperties, '$.code')
```

See the [ECSQL operators reference](../learning/ECSqlReference/Operators.md#is--is-not-operator-null-safe-comparison) for more details.

### Bulk instance write API for ECDb

Writing a large number of instances previously required one JavaScript-to-native call per row. At the scale of hundreds of thousands or millions of rows, the per-row boundary crossing dominates the cost.

Two new beta APIs submit homogeneous positional rows across the native boundary in a single call:

- [ECDb.bulkInsertInstances]($backend) — returns the [Id64String]($bentley) of every inserted instance, in input order.
- [ECDb.bulkUpdateInstances]($backend) — returns the number of rows that matched existing instances.

```ts
const properties = ["Name", "Age"];
const ids = ecdb.bulkInsertInstances("Example.Person", properties, [
  ["Alice", 42],
  ["Bob", 37],
]);

ecdb.bulkUpdateInstances("Example.Person", properties, [
  [ids[0], "Alice", 43],
]);
```

The class and property layout are resolved once per call. Every insert row contains one value per property; every update row starts with its `ECInstanceId`, followed by one value per property.

**All-or-nothing semantics.** Each batch runs inside a single savepoint. If any row fails, the entire batch is rolled back. Callers that want partial progress should submit smaller batches and handle failures per batch.


**Scope.** Bulk writes are available on [ECDb]($backend) only; there is deliberately no [IModelDb]($backend) equivalent. Writing BIS elements, models, and aspects directly through a bulk instance writer would bypass element handlers and the change-tracking that briefcase editing depends on, so iModel content should continue to be written through the [IModelDb]($backend) APIs.

Alongside the batching itself, six per-row bottlenecks were removed from the native instance writer: property-name lookups no longer allocate temporary strings on every property of every row, the statement cache no longer performs a linear most-recently-used reordering per row, the cache mutex is acquired once per batch instead of once per row, reading a property no longer round-trips its name out of V8 and back in as a freshly hashed string, each distinct ECClass name is resolved once per batch, and temporary N-API handles are released after each row instead of accumulating for the full call.

Measured against a per-row [ECSqlWriteStatement]($backend) bind/step loop over a five-property class (macOS arm64, release build), writing the same columns on both sides:

| Rows | Insert (statement → bulk) | Update | Delete |
| --- | --- | --- | --- |
| 10,000 | 0.062s → 0.029s (**2.1x**) | 0.063s → 0.036s (**1.8x**) | 0.031s → 0.011s (**2.8x**) |
| 100,000 | 0.72s → 0.27s (**2.6x**) | 0.89s → 0.36s (**2.5x**) | 0.21s → 0.11s (**1.9x**) |
| 1,000,000 | 7.94s → 2.87s (**2.8x**) | 10.08s → 3.41s (**3.0x**) | 2.40s → 1.07s (**2.3x**) |

**Where the remaining time goes.** Sampling a one-million-row bulk insert shows only about 9% of the time inside `sqlite3_step`; the bulk of the rest is spent reading properties off the supplied JavaScript objects across the N-API boundary. Callers that need to go substantially faster than the numbers above should reduce the amount of JSON handed across per row rather than expect further gains from larger batches.

**Choosing a batch size.** The speedup comes from amortizing the per-call cost, so it depends on how many rows each call carries, not on the total. Sweeping batch size over 100,000 rows (best of three runs):

| Rows per call | Insert | Update | Delete |
| --- | --- | --- | --- |
| 1 | 1.13x | 1.16x | 0.62x |
| 10 | 2.11x | 1.93x | 1.50x |
| 100 | 2.33x | 2.09x | 1.76x |
| 1,000 | 2.43x | 2.12x | 1.84x |
| 10,000 | 2.36x | 2.21x | 1.86x |
| all 100,000 | 2.23x | 2.16x | 1.86x |

At one row per call the batch API is no better than a plain statement loop, and is actually *slower* for delete, because a batch of one pays the savepoint and array-marshalling cost without amortizing it. Nearly all of the benefit is realised by about 100 rows per call and the curve is flat after roughly 1,000. Batches in the 1,000–10,000 range are therefore a good default: they capture the full speedup while bounding peak memory and keeping the all-or-nothing rollback window small. Passing millions of instances in a single call is supported but buys nothing further.

The comparison is reproducible via `npm run perftest:bulkInstanceWrite` in `full-stack-tests/backend` (set `BULK_WRITE_PERF_LARGE=1` to include the one-million-row case).

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
