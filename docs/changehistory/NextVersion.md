---
publish: false
---
# NextVersion

## Frontend

### Custom authentication for map-layer requests

Map layers previously supported only HTTP Basic credentials, custom query parameters, and ArcGIS-style tokens (a token appended as a query parameter by a [MapLayerAccessClient]($frontend)). Services requiring any other scheme - most commonly an `Authorization` or API-key header, e.g. when map services are exposed through an authenticating proxy - could not be consumed.

A new `@beta` extension point, [MapLayerFormatRegistry.addMapLayerFetchHandler]($frontend), lets the hosting application wrap every map-layer network request - tiles, tooltips, capabilities, service metadata, and source validation, across WMS, WMTS, TileURL, ArcGIS, ArcGIS Feature, and OGC API Features layers - the way a `DelegatingHandler` wraps `HttpClient` sends in .NET. Handlers form a pipeline owned by the framework, run in registration order. Each [MapLayerFetchHandler]($frontend) receives the request ([MapLayerRequest]($frontend)) and a `fetchRequest` function ([MapLayerFetchRequest]($frontend)) sending a request. It may:

- decline a request it does not manage by returning `undefined`: the request is offered unchanged to the next handler, and if every handler declines the framework issues it with the default behavior;
- pass a copy of the request with different query parameters or headers to `fetchRequest` (the request's target cannot be changed); the remaining handlers may modify it further before it is sent;
- call `fetchRequest` several times - e.g. refresh an expired token and retry transparently, so the layer never enters `RequireAuth`;
- return its own `Response` without calling `fetchRequest` (short-circuit);
- throw [MapLayerAuthenticationFailedError]($frontend) (now `@beta`) to report an unrecoverable authentication failure, transitioning the layer to [MapLayerImageryProviderStatus]($frontend).`RequireAuth`.

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

- `savedQueryParams` is renamed [ImageMapLayerSettings.queryParams]($common) / [MapLayerSource.queryParams]($frontend), matching the JSON property it has always been persisted as ([ImageMapLayerProps.queryParams]($common)). The old name remains as an accessor over the same value.
- `unsavedQueryParams` has no direct replacement: a secret or per-session parameter is injected by a [MapLayerFetchHandler]($frontend), keyed on [MapLayerRequest.layerUrl]($frontend) when it differs per layer; a non-secret parameter goes in `queryParams`.

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

### Opt-in fallback for missing navigation relationship class ids

Added `ECSQLOPTIONS NAV_REL_CLASSID_FALLBACK` for legacy navigation properties that contain an `Id` but no `RelECClassId`. When enabled, end-table relationship queries and `ECVLib.Relations()` report the relationship declared by the navigation property. Existing behavior is unchanged when the option is omitted, and directly selecting the navigation property's `RelECClassId` still returns its stored `NULL` value.

The option adds compatibility predicates that can result in less efficient query plans, so applications should enable it only for queries that need to read affected legacy data. `ECVLib.Relations()` also requires `ENABLE_EXPERIMENTAL_FEATURES`.

The ECSQL version was bumped to `2.0.4.2`.
