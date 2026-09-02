# Map-layer authentication

Map layers frequently target services that require authentication. iTwin.js supports several mechanisms: a token-based facility coordinated through one [MapLayerAccessClient]($frontend) per map-layer format, and a fetch handler on [MapLayerFormatRegistry]($frontend) giving the hosting application full control over every outgoing map-layer request.

An access client is registered on the [MapLayerFormatRegistry]($frontend) for a given format id, and the token-based requests made for a layer of that format consult it:

```ts
IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", myAccessClient);
```

There is exactly one access client per format — registering a new one replaces the previous one.

## OAuth-based authentication

[MapLayerAccessClient.getAccessToken]($frontend) produces a [MapLayerAccessToken]($frontend) — typically acquired through a standard OAuth2 flow, whose interactive login is supported by the optional members [MapLayerAccessClient.getTokenServiceEndPoint]($frontend) and [MapLayerAccessClient.onOAuthProcessEnd]($frontend) — and [MapLayerAccessClient.invalidateToken]($frontend) lets the provider discard an expired token so a fresh one is generated.

While token acquisition is pure OAuth2, the token's *delivery* follows the ESRI convention: providers append it to requests as the documented `token` query parameter, so this facility is consumed only by the ArcGIS providers. The `@itwin/map-layers-auth` package provides `ArcGisAccessClient`, a complete implementation supporting ArcGIS OAuth2 as well as legacy (non-OAuth) ArcGIS tokens generated from user credentials.

## The map-layer fetch handler

Some services use authentication schemes the OAuth facility above cannot express: an HTTP header such as `Authorization: Bearer …` or an API-key header (required for example by services exposed through an authenticating proxy), a custom query parameter under the hosting application's control, or a computed request signature. For these, the hosting application registers a `@beta` [MapLayerFetchHandler]($frontend) that wraps every map-layer network request — tiles, tooltips, capabilities, service metadata, and source validation, across **every** format — the way a `DelegatingHandler` wraps `HttpClient` sends in .NET:

```ts
IModelApp.mapLayerFormatRegistry.setMapLayerFetchHandler(myHandler);
```

There is at most one handler per session, owned by the hosting application — setting a new one replaces the previous one, and passing `undefined` restores the default behavior. The handler receives the request ([MapLayerRequest]($frontend)) and a `next` function ([MapLayerFetchNext]($frontend)) issuing the framework's default send — the equivalent of `base.SendAsync()`. It may:

- mutate the request's query parameters and headers in place, then call `next()`; the request's target (origin and path) cannot be changed;
- call `next()` several times — each call re-reads the request's current query parameters and headers, so a handler can refresh an expired token and retry transparently;
- return its own `Response` without calling `next()` (short-circuit);
- throw [MapLayerAuthenticationFailedError]($frontend) to report an unrecoverable authentication failure.

The handler runs on the hot path of tile loading; it should be fast and cache its tokens internally. Tile requests are issued concurrently, so when a token expires many of them observe the `401` at the same time — a handler that refreshes on `401` must coalesce those refreshes into a single in-flight operation (as `myTokenCache` does below), or it will hammer the token endpoint and may invalidate the token it just obtained. A single logical operation may invoke the handler more than once (e.g. the ArcGIS providers issue fallback and token-retry requests); each network request passes through the handler individually.

> **CORS**: in a browser, injecting a non-safelisted header (including `Authorization`) makes cross-origin requests subject to a CORS preflight — the map service (or the proxy in front of it) must list that header in its `Access-Control-Allow-Headers` response, or every request will be blocked by the browser before it is sent. Query parameters are not subject to this requirement.

A complete handler authenticating layers behind a proxy, with transparent token refresh:

```ts
// Coalesces concurrent refreshes: every caller observing the same expired token awaits one refresh.
const myTokenCache = {
  current: "",
  refreshing: undefined as Promise<void> | undefined,
  async refresh(expired: string): Promise<void> {
    if (this.current !== expired)
      return;                     // another caller already refreshed it
    this.refreshing ??= acquireToken().then((token) => { this.current = token; }).finally(() => this.refreshing = undefined);
    return this.refreshing;
  },
};

IModelApp.mapLayerFormatRegistry.setMapLayerFetchHandler(async (request: MapLayerRequest, next: MapLayerFetchNext) => {
  // The full request URL and format id are provided for routing decisions; a handler serving several
  // services can decide per request which credentials apply, or none at all.
  if (new URL(request.url).origin !== "https://proxy.example.com")
    return next();  // not ours: issue the request unmodified, with the default behavior

  // The hosting application obtains and refreshes this token through its own channels.
  const token = myTokenCache.current;
  request.headers.set("Authorization", `Bearer ${token}`);
  // Query-parameter based schemes are supported the same way:
  // request.searchParams.set("signature", sign(request.url));

  let response = await next();
  if (response.status === 401) {
    await myTokenCache.refresh(token);
    request.headers.set("Authorization", `Bearer ${myTokenCache.current}`);
    response = await next();                                // transparent retry - no RequireAuth
  }
  if (response.status === 401 || response.status === 403)
    throw new MapLayerAuthenticationFailedError(request.url); // unrecoverable: prompt the user
  return response;
});
```

### Responsibilities: the handler owns what it injects

Registering a handler means owning authentication for the requests it manages — the framework applies no default failure classification to responses the handler returns. Two rules keep the split clear:

- **What the framework injects, the framework protects.** Settings-derived basic auth and the browser's SSO identity keep their origin-trust rules ([MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]($frontend)) on every send, handler or not.
- **What the handler injects, the framework cannot recognize** — so every send whose headers or query parameters differ from what the framework built is conservatively treated as a credentialed request: redirects are refused while the trusted-origins restriction is enabled (so injected values cannot silently reach an unlisted origin through a redirect), and an NTLM/Negotiate 401 challenge is never answered with browser credentials (SSO). A send the handler passes through unmodified keeps the default behavior in full, so a handler serving one format does not degrade layers of the others.

A handler that fetches on its own instead of calling `next()` bypasses these protections entirely; it then owns transport security for that request.

### Layered applications

There is deliberately a single handler slot: composing security-relevant middleware requires someone to decide ordering and header conflicts, and that someone is the hosting application. When one layer of the application (e.g. a platform package) has already registered a handler and another layer needs its own, the second layer should compose with the existing one rather than replace it — [MapLayerFormatRegistry.setMapLayerFetchHandler]($frontend) logs a warning when it silently discards a previously registered handler:

```ts
const previous = IModelApp.mapLayerFormatRegistry.mapLayerFetchHandler;
IModelApp.mapLayerFormatRegistry.setMapLayerFetchHandler(
  previous
    // myHandler runs first (outermost); `previous` becomes its `next`, keeping both behaviors.
    ? (request, next) => myHandler(request, async () => previous(request, next))
    : myHandler);
```

The composing layer decides consciously whether it wraps outside (sees the request first, the response last) or inside the existing handler — the same responsibility a .NET host takes when assembling a `DelegatingHandler` chain. Handlers meant to be composed should tolerate running more than once per request (an outer handler's retry re-invokes the inner one) and use `headers.set` rather than `append` so repeated runs stay idempotent.

### One credential per layer

The handler is global, but [MapLayerRequest.layerUrl]($frontend) identifies the layer each request is made for. Unlike `request.url`, it is stable across every request kind (tiles, tooltips, capabilities, service metadata), so a single handler can serve any number of layers, each with its own credentials:

```ts
// Layer URL → token, obtained and refreshed by the hosting application through its own channels.
const tokensByLayer = new Map<string, string>();

IModelApp.mapLayerFormatRegistry.setMapLayerFetchHandler((request: MapLayerRequest, next: MapLayerFetchNext) => {
  const token = tokensByLayer.get(request.layerUrl);
  if (token !== undefined)
    request.headers.set("Authorization", `Bearer ${token}`);
  return next();
});
```

When the handler throws [MapLayerAuthenticationFailedError]($frontend), the layer's provider transitions to the [MapLayerImageryProviderStatus]($frontend) member `RequireAuth` and raises [MapLayerImageryProvider.onStatusChanged]($frontend), which applications can use to prompt the user to re-authenticate. How the provider behaves afterwards varies by format: the ArcGIS providers stop requesting tiles while in `RequireAuth`, while the other formats keep requesting new tiles — each still routed through the handler, so a handler that refreshes its token keeps the layer alive without intervention. Applications should keep monitoring this event even with a handler in place: transparent retries can make it rare, but it remains the only signal for failures the handler cannot fix silently (revoked access, expired refresh token), and other statuses such as `UntrustedOrigin` flow through it as well.

Once the application has re-established authentication, it must detach and re-attach the layer so that a fresh provider is created: a provider whose initialization failed never obtained the service's capabilities, and tiles that already failed are not re-requested. The same applies to a layer restored from a saved view before the handler was registered — once the handler is in place, re-attach the layer.

### Why a fetch handler rather than settings?

Authentication material is deliberately kept out of [ImageMapLayerSettings]($common): settings are serialized into display styles and saved views, so anything stored there is either persisted (a secret leak) or lost when a view is restored (a broken layer). The handler is registered once per session by the hosting application, is consulted at request time, and can refresh its tokens on its own schedule — a restored view works without any per-layer re-injection.

### Interaction with other mechanisms

- **Ordering** — the handler runs after the provider has fully assembled the request (protocol parameters, custom query parameters from [ImageMapLayerSettings.savedQueryParams]($common)/[ImageMapLayerSettings.unsavedQueryParams]($common), basic-auth headers, and the ArcGIS `token` parameter when applicable), so it sees the complete request and its values take precedence. This precedence is unconditional: nothing prevents a handler from overwriting protocol parameters such as `REQUEST` or `VERSION`, so a handler that injects parameters should use names that cannot collide with the protocols of the formats it targets.
- **Coexistence with OAuth-based auth** — both facilities operate independently. An ArcGIS layer using `ArcGisAccessClient` still has every request routed through the handler, letting it manage requests to a proxy origin while OAuth tokens keep flowing for every other origin.
- **Origin trust and redirects** — every send the handler modified is treated like a credentialed request by [MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]($frontend): while the restriction is enabled it is issued with `redirect: "error"`, so handler-injected values cannot silently reach an unlisted origin through a redirect. Sends passed through unmodified follow the default redirect policy. See [Map-layer security](./MapLayersAndBasemaps.md#map-layer-security).
- **SSO** — a send the handler modified never triggers the NTLM/Negotiate retry with browser credentials; the handler is the authentication authority for every request it touches. Sends passed through unmodified keep the SSO retry, so layers served by Windows-Authentication-protected services keep working alongside a handler that leaves their requests alone.
- **Caching** — while a handler is registered, the URL-keyed capability and service-metadata caches are bypassed, so customized responses are never shared across differing request contexts. This applies to all requests, including those the handler passes through unmodified: every source validation and provider initialization then re-issues its `GetCapabilities` / service-metadata request, a deliberate simplification whose cost is one extra request per layer attach.
- **Backward compatibility** — the handler is strictly opt-in. Without one, requests and failure detection are exactly as in previous releases, driven by the pre-existing status-code checks. With one, the framework applies no default failure classification to responses the handler returns; recognizing failures — by status code or protocol-specific convention (e.g. an error embedded in a `200` body) — and throwing [MapLayerAuthenticationFailedError]($frontend) is the handler's job.
