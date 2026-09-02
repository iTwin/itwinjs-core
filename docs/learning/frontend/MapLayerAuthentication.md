# Map-layer authentication

Map layers frequently target services that require authentication. iTwin.js supports several mechanisms: a token-based facility coordinated through one [MapLayerAccessClient]($frontend) per map-layer format, and a pair of request/response events on [MapLayerFormatRegistry]($frontend) giving the hosting application full control over every outgoing map-layer request.

An access client is registered on the [MapLayerFormatRegistry]($frontend) for a given format id, and the token-based requests made for a layer of that format consult it:

```ts
IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", myAccessClient);
```

There is exactly one access client per format — registering a new one replaces the previous one.

## OAuth-based authentication

[MapLayerAccessClient.getAccessToken]($frontend) produces a [MapLayerAccessToken]($frontend) — typically acquired through a standard OAuth2 flow, whose interactive login is supported by the optional members [MapLayerAccessClient.getTokenServiceEndPoint]($frontend) and [MapLayerAccessClient.onOAuthProcessEnd]($frontend) — and [MapLayerAccessClient.invalidateToken]($frontend) lets the provider discard an expired token so a fresh one is generated.

While token acquisition is pure OAuth2, the token's *delivery* follows the ESRI convention: providers append it to requests as the documented `token` query parameter, so this facility is consumed only by the ArcGIS providers. The `@itwin/map-layers-auth` package provides `ArcGisAccessClient`, a complete implementation supporting ArcGIS OAuth2 as well as legacy (non-OAuth) ArcGIS tokens generated from user credentials.

## Request and response events

Some services use authentication schemes the OAuth facility above cannot express: an HTTP header such as `Authorization: Bearer …` or an API-key header (required for example by services exposed through an authenticating proxy), a custom query parameter under the hosting application's control, or a computed request signature. For these, the hosting application registers listeners on [MapLayerFormatRegistry]($frontend) (`@beta`), modeled on the request/response pipeline of HTTP message handlers:

- [MapLayerFormatRegistry.addMapLayerRequestListener]($frontend) registers a listener invoked immediately before every map-layer request — tiles, tooltips, capabilities, service metadata, and source validation, across **every** format. Listeners may mutate the request's query parameters and headers in place ([MapLayerRequest]($frontend)); the request's target (origin and path) cannot be changed. The listeners are not authentication-specific — one can just as well inject non-authenticating values such as correlation headers or API-version parameters — which is why registration requires declaring whether the listener injects secrets: [MapLayerRequestListenerOptions.injectsCredentials]($frontend) opts the requests it shapes into the handling credentials require (see [Interaction with other mechanisms](#interaction-with-other-mechanisms)).
- [MapLayerFormatRegistry.addMapLayerResponseListener]($frontend) registers a listener invoked after each completed request — including responses with a successful HTTP status, since some protocols embed failures in a `200` body — letting the application recognize failures using whatever convention its service uses. [MapLayerResponse.failure]($frontend) arrives prefilled with the default classification (`"authentication"` for an HTTP 401/403 on a credentialed request); listeners may overwrite or clear it.

Listeners may be asynchronous: each is awaited in registration order before the request is issued or its response classified, so a listener can fetch a token — though listeners run on the hot path of tile loading, so they should be fast and cache their tokens internally. Both registration methods return a function that unregisters the listener.

> **CORS**: in a browser, injecting a non-safelisted header (including `Authorization`) makes cross-origin requests subject to a CORS preflight — the map service (or the proxy in front of it) must list that header in its `Access-Control-Allow-Headers` response, or every request will be blocked by the browser before it is sent. Query parameters are not subject to this requirement.

A complete pair of listeners authenticating layers behind a proxy:

```ts
IModelApp.mapLayerFormatRegistry.addMapLayerRequestListener((request: MapLayerRequest) => {
  // The full request URL and format id are provided for routing decisions; a listener serving several
  // services can decide per request which credentials apply, or none at all.
  if (new URL(request.url).origin !== "https://proxy.example.com")
    return;

  // The hosting application obtains and refreshes this token through its own channels.
  request.headers.set("Authorization", `Bearer ${myTokenCache.current}`);
  // Query-parameter based schemes are supported the same way:
  // request.searchParams.set("signature", sign(request.url));
}, { injectsCredentials: true });   // the injected value is a secret

IModelApp.mapLayerFormatRegistry.addMapLayerResponseListener(async (rsp: MapLayerResponse) => {
  // `failure` is already "authentication" for a 401/403 on a credentialed request; also recognize
  // failures using the service's own convention. Clone before reading the body so it remains
  // available to the provider.
  const json = await rsp.response.clone().json().catch(() => undefined);
  if (json?.error?.code === "TOKEN_EXPIRED")
    rsp.failure = "authentication";
});
```

### One credential per layer

The listeners are global, but [MapLayerRequest.layerUrl]($frontend) identifies the layer each request is made for. Unlike `request.url`, it is stable across every request kind (tiles, tooltips, capabilities, service metadata), so a single listener can serve any number of layers, each with its own credentials:

```ts
// Layer URL → token, obtained and refreshed by the hosting application through its own channels.
const tokensByLayer = new Map<string, string>();

IModelApp.mapLayerFormatRegistry.addMapLayerRequestListener((request: MapLayerRequest) => {
  const token = tokensByLayer.get(request.layerUrl);
  if (token !== undefined)
    request.headers.set("Authorization", `Bearer ${token}`);
}, { injectsCredentials: true });
```

When a response is classified as an authentication failure (by a listener, or by the default 401/403 rule on a credentialed request), the layer's provider transitions to the [MapLayerImageryProviderStatus]($frontend) member `RequireAuth` and raises [MapLayerImageryProvider.onStatusChanged]($frontend), which applications can use to prompt the user to re-authenticate. How the provider behaves afterwards varies by format: the ArcGIS providers stop requesting tiles while in `RequireAuth`, while the other formats keep requesting new tiles — each still submitted to the request listeners, so a listener that has silently refreshed its token keeps the layer alive without intervention. Applications should keep monitoring this event even with listeners in place: a listener that refreshes its tokens proactively can make the event rare, but it remains the only signal for failures the listener cannot fix silently (revoked access, expired refresh token), and other statuses such as `UntrustedOrigin` flow through it as well.

Once the application has re-established authentication, it must detach and re-attach the layer so that a fresh provider is created: a provider whose initialization failed never obtained the service's capabilities, and tiles that already failed are not re-requested. The same applies to a layer restored from a saved view before its listener was registered — once the listener is in place, re-attach the layer.

### Why listeners rather than settings?

Authentication material is deliberately kept out of [ImageMapLayerSettings]($common): settings are serialized into display styles and saved views, so anything stored there is either persisted (a secret leak) or lost when a view is restored (a broken layer). Listeners are registered once per session by the hosting application, are consulted at request time, and can refresh their tokens on their own schedule — a restored view works without any per-layer re-injection.

### Interaction with other mechanisms

- **Ordering** — request listeners run after the provider has fully assembled the request (protocol parameters, custom query parameters from [ImageMapLayerSettings.savedQueryParams]($common)/[ImageMapLayerSettings.unsavedQueryParams]($common), basic-auth headers, and the ArcGIS `token` parameter when applicable), so listeners see the complete request and their values take precedence. This precedence is unconditional: nothing prevents a listener from overwriting protocol parameters such as `REQUEST` or `VERSION`, so a listener that injects parameters should use names that cannot collide with the protocols of the formats it targets. Multiple listeners are awaited in registration order; each sees the mutations of those before it, and for `failure` the last writer wins.
- **Coexistence with OAuth-based auth** — both facilities operate independently. An ArcGIS layer using `ArcGisAccessClient` still has every request submitted to the request listeners, letting a listener shape requests to a proxy origin while OAuth tokens keep flowing for every other origin.
- **Origin trust and redirects** — requests shaped by a listener registered with [MapLayerRequestListenerOptions.injectsCredentials]($frontend) are treated like credentialed requests by [MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]($frontend): while the restriction is enabled they are issued with `redirect: "error"`, so the injected values cannot silently reach an unlisted origin through a redirect. See [Map-layer security](./MapLayersAndBasemaps.md#map-layer-security).
- **SSO** — a request shaped by a listener registered with `injectsCredentials` never triggers the NTLM/Negotiate retry with browser credentials; the injecting listener is the authentication authority for it. Consequently, layers served by a Windows-Authentication-protected service cannot be combined with a credentialed listener shaping their requests: their 401 challenge is classified as an authentication failure (`RequireAuth`) instead of being answered with browser credentials. This applies even to requests such a listener chooses not to modify; listeners registered with `injectsCredentials: false` preserve the SSO behavior.
- **Caching** — while any request listener is registered, the URL-keyed capability and service-metadata caches are bypassed, so shaped responses are never shared across differing request-shaping contexts. This applies to all requests, including those a listener chooses not to modify.
- **Backward compatibility** — the listeners are strictly opt-in. Without listeners, requests and failure detection are exactly as in previous releases, driven by the pre-existing status-code checks. Registering with `injectsCredentials` opts the shaped requests into the default 401/403 classification above, and response listeners have the final word on every response they inspect.
