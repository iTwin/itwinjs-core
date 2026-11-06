---
publish: false
---
# NextVersion

<!-- prettier-ignore -->
- [NextVersion](#nextversion)
  - [Frontend](#frontend)
    - [Linked iModels](#linked-imodels)
    - [ViewState property updates](#viewstate-property-updates)
    - [Custom authentication for map-layer requests](#custom-authentication-for-map-layer-requests)
    - [Map-layer query parameters: `queryParams` replaces `savedQueryParams`/`unsavedQueryParams`](#map-layer-query-parameters-queryparams-replaces-savedqueryparamsunsavedqueryparams)
  - [Backend](#backend)
    - [Bulk Element Deletion API changes](#bulk-element-deletion-api-changes)
  - [Platform support](#platform-support)
    - [Node.js 26 support](#nodejs-26-support)
  - [API deprecations](#api-deprecations)
    - [HitDetail feature identity](#hitdetail-feature-identity)
    - [Viewport display APIs](#viewport-display-apis)
    - [Graphic branch iModel attribution](#graphic-branch-imodel-attribution)

## Frontend

### Linked iModels

Spatial views can display linked iModels, each with its own visibility, display overrides, and feature override providers. Use [IModelDisplayReferenceFeatureOverrideProvider]($frontend) or [EmphasizeIModelElements]($frontend) to provide reference-specific symbology or emphasis. See [Referencing Linked iModels](../learning/LinkedIModels.md) for details.

### ViewState property updates

The `categorySelector`, `modelSelector`, and `displayStyle` setters remain supported, but wholesale replacement of these objects is discouraged. Prefer updating selector contents instead of replacing selectors, and use `cloneWithDisplayStyle` to create a view with a different display style. The `ViewState.setDisplayStyle` and `ViewState.setCategorySelector` methods are deprecated in favor of those approaches.

### Custom authentication for map-layer requests

Map layers previously supported only HTTP Basic credentials, custom query parameters, and ArcGIS-style tokens (a token appended as a query parameter by a [MapLayerAccessClient]($frontend)). Services requiring any other scheme - most commonly an `Authorization` or API-key header, e.g. when map services are exposed through an authenticating proxy - could not be consumed.

A new `@beta` extension point, [MapLayerFormatRegistry.addMapLayerFetchHandler]($frontend), lets the hosting application wrap every map-layer network request - tiles, tooltips, capabilities, service metadata, and source validation, across WMS, WMTS, TileURL, ArcGIS, ArcGIS Feature, and OGC API Features layers. Handlers form a pipeline owned by the framework, run in registration order. Each [MapLayerFetchHandler]($frontend) receives the request ([MapLayerRequest]($frontend)) and a `fetchRequest` function ([MapLayerFetchRequest]($frontend)) that sends a request onward: through the remaining handlers, then to the network. It may:

- decline a request it does not manage by returning `undefined`: the next handler sees the request exactly as the declining one received it, and if every handler declines the framework issues it with the default behavior
- pass a copy of the request with different query parameters or headers to `fetchRequest` (the request's target cannot be changed); the remaining handlers may modify it further before it is sent
- call `fetchRequest` one or more times - e.g. refresh an expired token and retry transparently, so the layer never enters `RequireAuth`
- return its own `Response` without calling `fetchRequest` (short-circuit)
- throw [MapLayerAuthenticationFailedError]($frontend) (now `@beta`) to report an unrecoverable authentication failure, transitioning the layer to [MapLayerImageryProviderStatus]($frontend).`RequireAuth`

```ts
// Approve destinations for this token explicitly; a format id alone is not a trust boundary.
const authOrigins = new Set(["https://proxy.example.com"]);
const removeHandler = IModelApp.mapLayerFormatRegistry.addMapLayerFetchHandler(async (request, fetchRequest) => {
  if (request.formatId !== "WMS")
    return undefined;  // not ours: leave the request to the next handler, or to the default behavior
  const target = new URL(request.url, document.baseURI);
  if ((target.protocol !== "https:" && target.protocol !== "http:") || !authOrigins.has(target.origin))
    return undefined;
  const withBearer = (token: string) => {
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return { ...request, headers };
  };
  let response = await fetchRequest(withBearer(tokens.current));
  if (response.status === 401) {
    await tokens.refresh();
    response = await fetchRequest(withBearer(tokens.current));  // transparent retry
  }
  if (response.status === 401 || response.status === 403)
    throw new MapLayerAuthenticationFailedError(request.url); // unrecoverable: prompt the user
  return response;
});
```

`addMapLayerFetchHandler` returns the function that removes the handler. Several layers of an application can register their own handler without coordinating.

A handler owns authentication for the requests it manages, and only it knows whether a value it injected is a secret - so every send issued through `fetchRequest` is a credentialed request: redirects are refused while [MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]($frontend) is enabled (so injected values cannot silently reach an unlisted origin), and an NTLM/Negotiate 401 challenge is never answered with browser credentials. A request the handler does not manage is declined rather than sent, and keeps the default behavior in full, so a handler serving one format does not affect layers of the others (e.g. Windows-Authentication-protected WMS services); because a request sent by a handler is always issued credentialed, no handler further down the pipeline can downgrade that protection. The framework keeps protecting the credentials it supplies itself - settings-derived basic auth and the browser's SSO identity - on every send.

The feature is fully backward compatible: without a handler, requests and failure detection are exactly as in previous releases, and [MapLayerAccessClient]($frontend) (including `ArcGisAccessClient` from `@itwin/map-layers-auth`) keeps serving the token-based ArcGIS facility unchanged. Because handlers are registered per session rather than persisted in [ImageMapLayerSettings]($common), no secret is ever serialized into display styles or saved views, and restored views authenticate without per-layer re-injection. While a handler is registered, URL-keyed capability/service-metadata caches are bypassed so customized responses are not shared across differing request contexts.

Additionally, WMS and WMTS `GetCapabilities` requests issued when a layer initializes now include the layer's custom query parameters ([ImageMapLayerSettings.queryParams]($common)), matching the source-validation path; previously they were omitted, which could break reloading a layer whose server requires them.

See [Map-layer authentication](../learning/frontend/MapLayerAuthentication.md) for the full behavior and complete samples.

### Map-layer query parameters: `queryParams` replaces `savedQueryParams`/`unsavedQueryParams`

With the fetch handler as the designated channel for secrets, the split between persisted and non-persisted custom query parameters no longer has a purpose, and the non-persisted one was never a safe place for a secret (a value in `unsavedQueryParams` follows redirects and is sent along with an NTLM/Negotiate retry). Both `@beta` fields are deprecated on [ImageMapLayerSettings]($common) and [MapLayerSource]($frontend); they keep working until removed in the next major version.

- `savedQueryParams` is renamed [ImageMapLayerSettings.queryParams]($common) / [MapLayerSource.queryParams]($frontend), matching the JSON property it has always been persisted as ([ImageMapLayerProps.queryParams]($common)). The new name is an accessor over the existing field, so code that redeclares or deletes `savedQueryParams` is unaffected.
- `unsavedQueryParams` has no direct replacement: a secret or per-session parameter is injected by a [MapLayerFetchHandler]($frontend), keyed on [MapLayerRequest.layerUrl]($frontend) when it differs per layer; a non-secret parameter goes in `queryParams`. Until it is removed, `collectQueryParams()` remains the merged view actually sent, and every request kind now applies the same precedence: a key present in both maps takes its value from `unsavedQueryParams` (tile requests previously favored the persisted value).

```ts
// Before
settings.unsavedQueryParams = { apiKey: secret };

// After: parameters assigned to each layer, sent only to that layer's own origin
const secretParamsByLayer = new Map<string, { [key: string]: string }>();
secretParamsByLayer.set(settings.url, { apiKey: secret });

IModelApp.mapLayerFormatRegistry.addMapLayerFetchHandler(async (request, fetchRequest) => {
  const params = secretParamsByLayer.get(request.layerUrl);
  if (!params)
    return undefined;   // not a layer this handler manages
  const target = new URL(request.url, document.baseURI);
  const layer = new URL(request.layerUrl, document.baseURI);
  if ((target.protocol !== "https:" && target.protocol !== "http:") || target.origin !== layer.origin)
    return undefined;   // a server-advertised link must not inherit this layer's secrets
  const searchParams = new URLSearchParams(request.searchParams);
  for (const [name, value] of Object.entries(params))
    searchParams.set(name, value);
  const response = await fetchRequest({ ...request, searchParams });
  if (response.status === 401 || response.status === 403)
    throw new MapLayerAuthenticationFailedError(request.url); // the handler classifies the responses it returns
  return response;
});
```

`layerUrl` is also the URL of a [MapLayerSource]($frontend) during validation, so the same entry serves the attach dialog's validation request and every later request of the layer.

This per-layer example intentionally supports only same-origin requests. Cross-origin authentication requires explicit approval for that particular secret. Also enable `MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins` to block redirects of handler-injected values: it does not replace the direct-destination checks in these samples.

## Backend

### Bulk Element Deletion API changes

[EditTxn.deleteElements]($backend) *(beta)* is now **all-or-nothing**. Previously the call deleted whatever it could and returned `PartialSuccess` with the ids it had to skip. Now, if any element in the expanded delete set (requested elements plus their children and sub-model contents) is still referenced from *outside* the set, nothing is deleted and the status is `ConstraintViolation`. The validation runs before anything is modified, so a rejected call leaves the iModel and the current txn untouched.

```ts
const result = txn.deleteElements(ids);
if (result.status === BulkDeleteElementsStatus.ConstraintViolation) {
  for (const failure of result.failures)
    console.log(`${failure.elementId}: ${BulkDeleteFailureReason[failure.reason]}`);
}
```

Changes to the beta types:

- `BulkDeleteElementsStatus.PartialSuccess` has been **removed**. The enum is now `Success` (0), `ConstraintViolation` (1) and `DeletionFailed` (2). Code that handled `PartialSuccess` should handle `ConstraintViolation` instead - and note that in that case *nothing* was deleted.
- New [BulkDeleteElementsResult.failures]($backend): a per-element report. Each [BulkDeleteFailure]($backend) carries the element id, a [BulkDeleteFailureReason]($backend) (`ReferencedByForeignKey`, `DefinitionInUse`, `ProtectedElement` or `ReadOnlyDomain`). Only the *direct* violators are reported. Because the whole expanded set is validated, a reported element may be a child or sub-model member that was **not** in the `ids` you passed in; its requested ancestor is not listed separately. For example, requesting `[parent]` when `parent`'s child is the CodeScope of an element outside the set reports the *child*, not `parent`.
- `BulkDeleteElementsResult.failedIds` is deprecated in favor of `failures`. Its contents have changed:
  - On `ConstraintViolation` it holds the unique element ids appearing in `failures`. As described above, these may include cascaded descendants that were not in the requested `ids`, so `failedIds` is no longer guaranteed to be a subset of the input. It is never empty on `ConstraintViolation`, so existing `failedIds.size > 0` checks still detect a rejected delete. However, it no longer lists everything left undeleted: for input `[blocked, independent]`, both remain undeleted while `failedIds` reports only `blocked`. Callers that filter this list to existing elements and throw still detect rejection, but their error reports omit other undeleted elements.
  - On `DeletionFailed` it holds every requested id, matching the previous behavior for this status, so callers that only check `failedIds.size > 0` still detect the failure. The iModel may be partially modified in this case and the caller must abandon the current txn.
  - On `Success` it is empty.
- `BulkDeleteElementsArgs.skipFKConstraintValidations` is deprecated and **ignored**. Skipping the validation pass could leave the iModel with dangling references (e.g. a deleted GeometryPart still used by a geometry stream), so that behavior was removed. The option object is still accepted so existing calls keep compiling.

If you relied on the previous best-effort behavior, inspect `failures` and, for each reported element, either include or update the elements that reference it, or remove it from `ids` together with every requested element it was cascaded from; then call `deleteElements` again. Retries may reveal further violators. Callers that ignored the result, or treated a non-`Success` status as non-fatal, now delete nothing instead of the valid subset.

See [Bulk Element Deletion]($docs/learning/backend/BulkElementDeletion.md) for full details.

## Platform support

### Node.js 26 support

In addition to [already supported Node.js versions](../learning/SupportedPlatforms.md#supported-nodejs-versions), iTwin.js now supports [Node.js 26](https://nodejs.org/en/blog/release/v26.13.0). Node.js 26 is not yet supported by `@itwin/core-mobile`.

## API deprecations

### HitDetail feature identity

The [HitDetailProps]($frontend) interface is deprecated in favor of [HitDetailFeatureProps]($frontend).

Similarly, the `sourceId`, `subCategoryId`, `geometryClass`, and `modelId` members of [Pixel.HitProps]($frontend) are deprecated in favor of its `feature` member, and `Pixel.Data.iModel` is deprecated in favor of the `iModelRef` of [Pixel.Data.feature]($frontend). Note that `Pixel.Data.iModel` was previously defined only for geometry originating from an iModel other than the viewport's own; it is now defined for every pixel produced by a feature.

Additionally, the type of `Pixel.Data.feature` changed from the [Feature]($common) class to the [IModelDisplayFeature]($frontend) interface. Reading its `elementId`, `subCategoryId`, and `geometryClass` properties is unaffected, and it now also exposes `modelId` and `iModelRef`; however, code relying on the `Feature` class - its `equals`, `compare`, `isDefined`, and `isUndefined` members, `instanceof` checks, or assignment to `Feature`-typed variables - must be updated to treat it as a plain object, e.g. by comparing with [IModelDisplayFeature.compare]($frontend).

### Viewport display APIs

Viewport-level APIs for model and category display overrides, viewed models, and always/never-drawn elements are deprecated in favor of APIs on [IModelDisplayReference]($frontend) and [SpatialIModelDisplayReference]($frontend).

`PerModelCategoryVisibility.createOverrides` is also deprecated: the standalone object it returns is never consulted when rendering. Use the [IModelDisplayReference.perModelCategoryVisibility]($frontend) of the iModel reference whose display you want to change.

### Graphic branch iModel attribution

The `iModel` and `transformFromIModel` members of [GraphicBranchOptions]($frontend) are deprecated in favor of [GraphicBranchOptions.iModelRef]($frontend). When only `iModel` is supplied, the branch's graphics are attributed to the view's [IModelDisplayReference]($frontend) displaying that iModel if one exists, or otherwise to a reference identifying it as a foreign iModel; a supplied `transformFromIModel` becomes that reference's [IModelDisplayReference.linearTransformToParent]($frontend). When both `iModel` and `iModelRef` are supplied, `iModelRef` takes precedence.
