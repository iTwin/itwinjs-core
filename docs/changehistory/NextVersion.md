---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Schema sync rework](#schema-sync-rework)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Custom authentication for map-layer requests](#custom-authentication-for-map-layer-requests)
  - [Electron 44 support](#electron-44-support)

## @itwin/core-backend

### Schema sync rework

Schema sync lets the briefcases of one iModel import ECSchemas without taking the exclusive schema lock. This new version explicitly splits between updates, which update the sync db, and upgrades which rewrite the sync db and push it with the briefcase at the same time via the new `BriefcaseDb.upgradeSchemas` API.

Updates no longer automatically end up in other users' briefcases when they import schemas. Instead, they only pick the reference closure of what they import, so updates only hit when a briefcase pushes.

A change that would move or destroy existing data is now refused with `BE_SQLITE_ERROR_DataTransformRequired` or the new `BE_SQLITE_ERROR_DataDeletionRequired`; the new `@alpha` `BriefcaseDb.upgradeSchemas` runs those under the exclusive schema lock and lands the changeset and the sync db together. iModels without schema sync are unaffected.

SchemaSync databases now require version 5.0.0. Existing version 4 containers are outside this compatibility boundary and cannot be opened by this release.

## @itwin/core-frontend

### Custom authentication for map-layer requests

Map layers previously supported only HTTP Basic credentials, custom query parameters, and ArcGIS-style tokens (a token appended as a query parameter by a [MapLayerAccessClient]($frontend)). Services requiring any other scheme - most commonly an `Authorization` or API-key header, e.g. when map services are exposed through an authenticating proxy - could not be consumed.

A new `@beta` extension point, [MapLayerFormatRegistry.setMapLayerFetchHandler]($frontend), lets the hosting application wrap every map-layer network request - tiles, tooltips, capabilities, service metadata, and source validation, across WMS, WMTS, TileURL, ArcGIS, ArcGIS Feature, and OGC API Features layers - the way a `DelegatingHandler` wraps `HttpClient` sends in .NET. The [MapLayerFetchHandler]($frontend) receives the request ([MapLayerRequest]($frontend)) and a `fetchRequest` function ([MapLayerFetchRequest]($frontend)) that issues the framework's default send for a request. It may:

- pass a copy of the request with different query parameters or headers to `fetchRequest` (the request's target cannot be changed);
- call `fetchRequest` several times - e.g. refresh an expired token and retry transparently, so the layer never enters `RequireAuth`;
- return its own `Response` without calling `fetchRequest` (short-circuit);
- throw [MapLayerAuthenticationFailedError]($frontend) (now `@beta`) to report an unrecoverable authentication failure, transitioning the layer to [MapLayerImageryProviderStatus]($frontend).`RequireAuth`.

```ts
IModelApp.mapLayerFormatRegistry.setMapLayerFetchHandler(async (request, fetchRequest) => {
  if (request.formatId !== "WMS")
    return fetchRequest(request, { credentialed: false });  // not ours: issue the request untouched, with the default behavior
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
  return response;
});
```

There is at most one handler per session, owned by the hosting application; setting a new one replaces the previous one, and passing `undefined` restores the default behavior.

The handler owns authentication for the requests it manages, and only it knows whether a value it injected is a secret - so every send issued through `fetchRequest` is treated as a credentialed request: redirects are refused while [MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]($frontend) is enabled (so injected values cannot silently reach an unlisted origin), and an NTLM/Negotiate 401 challenge is never answered with browser credentials. For requests it leaves untouched, the handler passes `fetchRequest(request, { credentialed: false })` ([MapLayerFetchRequestOptions]($frontend)) and they keep the default behavior in full, so a handler serving one format does not affect layers of the others (e.g. Windows-Authentication-protected WMS services). The framework keeps protecting the credentials it supplies itself - settings-derived basic auth and the browser's SSO identity - on every send.

The feature is fully backward compatible: without a handler, requests and failure detection are exactly as in previous releases, and [MapLayerAccessClient]($frontend) (including `ArcGisAccessClient` from `@itwin/map-layers-auth`) keeps serving the token-based ArcGIS facility unchanged. Because the handler is registered per session rather than persisted in [ImageMapLayerSettings]($common), no secret is ever serialized into display styles or saved views, and restored views authenticate without per-layer re-injection. While a handler is registered, URL-keyed capability/service-metadata caches are bypassed so customized responses are not shared across differing request contexts.

Additionally, WMS and WMTS `GetCapabilities` requests issued when a layer initializes now include the layer's custom query parameters ([ImageMapLayerSettings.savedQueryParams]($common)/[ImageMapLayerSettings.unsavedQueryParams]($common)), matching the source-validation path; previously they were omitted, which could break reloading a layer whose server requires them.

See [Map-layer authentication](../learning/frontend/MapLayerAuthentication.md) for the full behavior and complete samples.

## Electron 44 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 44](https://www.electronjs.org/blog/electron-44-0).
