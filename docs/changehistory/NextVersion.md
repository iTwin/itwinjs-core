---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Schema sync rework](#schema-sync-rework)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Custom authentication for map-layer requests](#custom-authentication-for-map-layer-requests)

## @itwin/core-backend

### Schema sync rework

Schema sync lets the briefcases of one iModel import ECSchemas without taking the exclusive schema lock. This new version explicitly splits between updates, which update the sync db, and upgrades which rewrite the sync db and push it with the briefcase at the same time via the new `BriefcaseDb.upgradeSchemas` API.

Updates no longer automatically end up in other users' briefcases when they import schemas. Instead, they only pick the reference closure of what they import, so updates only hit when a briefcase pushes.

A change that would move or destroy existing data is now refused with `BE_SQLITE_ERROR_DataTransformRequired` or the new `BE_SQLITE_ERROR_DataDeletionRequired`; the new `@alpha` `BriefcaseDb.upgradeSchemas` runs those under the exclusive schema lock and lands the changeset and the sync db together. iModels without schema sync are unaffected.

SchemaSync databases now require version 5.0.0. Existing version 4 containers are outside this compatibility boundary and cannot be opened by this release.

## @itwin/core-frontend

### Custom authentication for map-layer requests

Map layers previously supported only HTTP Basic credentials, custom query parameters, and ArcGIS-style tokens (a token appended as a query parameter by a [MapLayerAccessClient]($frontend)). Services requiring any other scheme - most commonly an `Authorization` or API-key header, e.g. when map services are exposed through an authenticating proxy - could not be consumed.

Two new `@beta` registration points on [MapLayerFormatRegistry]($frontend) - modeled on the request/response pipeline of HTTP message handlers - give the hosting application full control over every outgoing map-layer request and its response:

- [MapLayerFormatRegistry.addMapLayerRequestListener]($frontend) registers a listener invoked immediately before every map-layer request - tiles, tooltips, capabilities, service metadata, and source validation, across WMS, WMTS, TileURL, ArcGIS, ArcGIS Feature, and OGC API Features layers. Listeners may mutate the request's query parameters and headers in place ([MapLayerRequest]($frontend)); the request's target cannot be changed. Registration requires declaring whether the listener injects secrets ([MapLayerRequestListenerOptions.injectsCredentials]($frontend)).
- [MapLayerFormatRegistry.addMapLayerResponseListener]($frontend) registers a listener invoked after each completed request - including responses with a successful HTTP status, since some protocols embed failures in a `200` body. [MapLayerResponse.failure]($frontend) arrives prefilled with the default classification (`"authentication"` for an HTTP 401/403 on a request shaped by a listener registered with `injectsCredentials`); listeners may overwrite or clear it, and whatever value remains is acted upon: `"authentication"` transitions the layer to [MapLayerImageryProviderStatus]($frontend).`RequireAuth`.

```ts
IModelApp.mapLayerFormatRegistry.addMapLayerRequestListener((request) => {
  if (request.formatId !== "WMS")
    return;
  request.headers.set("Authorization", `Bearer ${myToken}`);
}, { injectsCredentials: true });
```

Listeners may be asynchronous: each is awaited in registration order before the request is issued or its response classified. Both registration methods return a function that unregisters the listener.

The feature is fully backward compatible - nothing changes until a listener is registered:

- **No listeners**: requests are issued exactly as before, and authentication failures are detected by the existing status-code checks (e.g. HTTP 401). [MapLayerAccessClient]($frontend) (including `ArcGisAccessClient` from `@itwin/map-layers-auth`) keeps serving the token-based ArcGIS facility, unchanged.
- **A request listener registered with `injectsCredentials: false`** (e.g. one injecting only correlation headers): the requests it shapes keep their legacy handling - SSO retries, redirects, and failure detection are untouched.
- **A request listener registered with `injectsCredentials: true`**: every request it shapes is handled with the care credentials require - redirects are refused while [MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]($frontend) is enabled, an NTLM/Negotiate 401 challenge is never answered with browser credentials (SSO), and an HTTP 401/403 response transitions the layer to `RequireAuth` by default. This applies even to requests the listener chooses not to modify.
- **A response listener**: it has the final word on the classification of every response it inspects, overriding or suppressing the default rule.

Because listeners are registered per session rather than persisted in [ImageMapLayerSettings]($common), no secret is ever serialized into display styles or saved views, and restored views authenticate without per-layer re-injection. While any request listener is registered, URL-keyed capability/service-metadata caches are bypassed so shaped responses are not shared across differing request-shaping contexts.

Additionally, WMS and WMTS `GetCapabilities` requests issued when a layer initializes now include the layer's custom query parameters ([ImageMapLayerSettings.savedQueryParams]($common)/[ImageMapLayerSettings.unsavedQueryParams]($common)), matching the source-validation path; previously they were omitted, which could break reloading a layer whose server requires them.

See [Map-layer authentication](../learning/frontend/MapLayerAuthentication.md) for the full behavior and complete samples.
