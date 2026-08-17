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
  - [@itwin/core-common](#itwincore-common)
    - [Rank support for DefinitionSet](#rank-support-for-definitionset)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Invalidate decorations when element visibility changes](#invalidate-decorations-when-element-visibility-changes)
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

## @itwin/core-common

### Rank support for DefinitionSet

[BisCore:DefinitionSet]($docs/bis/domains/BisCore.ecschema.md) (the base class of [DefinitionContainer]($backend) and [DefinitionGroup]($backend)) has a `Rank` property, but the iTwin.js API had no counterpart for it - `Rank` was only exposed for [Category]($backend)/[SubCategory]($backend). The new `@beta` [DefinitionSetProps.rank]($common) property (and the corresponding [DefinitionSet.rank]($backend) member) close that gap, using the same [Rank]($common) enum already used by `CategoryProps.rank`. `rank` is persisted when inserting or updating a `DefinitionContainer` or `DefinitionGroup`, and is read back correctly through [IModelDb.Elements.getElementProps]($backend) and [DefinitionSet.toJSON]($backend).

## @itwin/core-frontend

### Invalidate decorations when element visibility changes

[ViewportDecorator]($frontend)s often produce decoration graphics associated with elements in the scene. Such graphics should be updated if the visibility of the associated element changes. For example, a measurement tool might draw a label near a pipe indicating its length. The label should disappear if the user hides the pipe. To facilitate this, all cached decorations (produced and reused when [ViewportDecorator.useCachedDecorations]($frontend) is `true`) are now recreated in response to potential changes to the visibility of elements in a viewport, including modification of the sets of always- and never-drawn elements, displayed categories and subcategories, and feature symbology overrides.

## @itwin/core-frontend

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
