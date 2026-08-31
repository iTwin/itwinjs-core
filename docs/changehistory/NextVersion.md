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

[MapLayerAccessClient]($frontend) now extends a new `@beta` contract, [MapLayerRequestShaper]($frontend), giving the hosting application full control over the query parameters and headers of every request made for a given map-layer format — authentication being the most common use:

- `applyToRequest` is invoked immediately before every request made for a layer of the registered format - tiles, tooltips, capabilities, service metadata, and source validation, across WMS, WMTS, TileURL, ArcGIS, ArcGIS Feature, and OGC API Features layers - and may mutate the request's query parameters and headers in place ([MapLayerRequest]($frontend)). The request's target cannot be changed.
- [MapLayerRequestShaper.classifyResponse]($frontend) lets the client recognize failures using its protocol's own convention ([MapLayerResponse]($frontend)); returning `"authentication"` transitions the layer to [MapLayerImageryProviderStatus]($frontend).`RequireAuth`. When omitted, HTTP 401/403 responses are treated as authentication failures.

```ts
IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", {
  getAccessToken: async () => undefined,
  applyToRequest: ({ headers }) => headers.set("Authorization", `Bearer ${myToken}`),
});
```

Both members are optional, and the feature is fully backward compatible — nothing changes until a client opts in:

- **No access client, or a client without `applyToRequest`** (including `ArcGisAccessClient` from `@itwin/map-layers-auth`): behavior is unchanged. Requests are issued exactly as before, and authentication failures are detected by the existing status-code checks (e.g. HTTP 401).
- **A client implementing `applyToRequest` only**: its shaped requests are classified by a default rule — HTTP 401 or 403 transitions the layer to `RequireAuth`.
- **A client also implementing `classifyResponse`**: it becomes the sole authority for its shaped requests; the default status-code rule no longer applies to them.

Because the access client is registered per session rather than persisted in [ImageMapLayerSettings]($common), no secret is ever serialized into display styles or saved views, and restored views authenticate without per-layer re-injection. Requests shaped by `applyToRequest` are treated like credentialed requests by [MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]($frontend) (redirects refused while the restriction is enabled), never trigger the NTLM/Negotiate SSO retry, and bypass URL-keyed capability/service-metadata caches so authenticated responses are not shared across differing authentication contexts.

Additionally, WMS and WMTS `GetCapabilities` requests issued when a layer initializes now include the layer's custom query parameters ([ImageMapLayerSettings.savedQueryParams]($common)/[ImageMapLayerSettings.unsavedQueryParams]($common)), matching the source-validation path; previously they were omitted, which could break reloading a layer whose server requires them.

See [Map-layer authentication](../learning/frontend/MapLayerAuthentication.md) for the full behavior and a complete sample client.
