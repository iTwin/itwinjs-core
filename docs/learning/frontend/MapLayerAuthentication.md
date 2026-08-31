# Map-layer authentication

Map layers frequently target services that require authentication. iTwin.js supports several mechanisms, all coordinated through a single object per map-layer format: the [MapLayerAccessClient]($frontend).

An access client is registered on the [MapLayerFormatRegistry]($frontend) for a given format id, and every request made for a layer of that format consults it:

```ts
IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", myAccessClient);
```

There is exactly one access client per format — registering a new one replaces the previous one. A client can implement one or both of the following facilities.

## OAuth-based authentication

[MapLayerAccessClient.getAccessToken]($frontend) produces a [MapLayerAccessToken]($frontend) — typically acquired through a standard OAuth2 flow, whose interactive login is supported by the optional members [MapLayerAccessClient.getTokenServiceEndPoint]($frontend) and [MapLayerAccessClient.onOAuthProcessEnd]($frontend) — and [MapLayerAccessClient.invalidateToken]($frontend) lets the provider discard an expired token so a fresh one is generated.

While token acquisition is pure OAuth2, the token's *delivery* follows the ESRI convention: providers append it to requests as the documented `token` query parameter, so this facility is consumed only by the ArcGIS providers. The `@itwin/map-layers-auth` package provides `ArcGisAccessClient`, a complete implementation supporting ArcGIS OAuth2 as well as legacy (non-OAuth) ArcGIS tokens generated from user credentials.

## Request-shaping authentication

Some services use authentication schemes the OAuth facility above cannot express: an HTTP header such as `Authorization: Bearer …` or an API-key header (required for example by services exposed through an authenticating proxy), a custom query parameter under the hosting application's control, or a computed request signature. For these, an access client implements the [MapLayerRequestShaper]($frontend) contract, which gives the hosting application full control over both the headers and the query parameters of each outgoing request, and applies to **every** map-layer format. The contract itself is not authentication-specific — it can just as well inject non-authenticating values such as correlation headers or API-version parameters — but shaped requests are always handled with the care credentials require (see [Interaction with other mechanisms](#interaction-with-other-mechanisms)):

- [MapLayerRequestShaper.applyToRequest]($frontend) is invoked immediately before every request made for a layer of the registered format — tiles, tooltips, capabilities, service metadata, and source validation — and may mutate the request's query parameters and headers in place. The request's target (origin and path) cannot be changed.
- [MapLayerRequestShaper.classifyResponse]($frontend) is invoked after each request that `applyToRequest` shaped, letting the client recognize failures using whatever convention its protocol uses; returning `"authentication"` marks the request as an authentication failure. When omitted, HTTP 401/403 responses are treated as authentication failures.

> **CORS**: in a browser, injecting a non-safelisted header (including `Authorization`) makes cross-origin requests subject to a CORS preflight — the map service (or the proxy in front of it) must list that header in its `Access-Control-Allow-Headers` response, or every request will be blocked by the browser before it is sent. Query parameters are not subject to this requirement.

A complete client authenticating layers behind a proxy:

```ts
const proxyAccessClient: MapLayerAccessClient = {
  // Not used by this client; required member of MapLayerAccessClient.
  getAccessToken: async () => undefined,

  applyToRequest: (request: MapLayerRequest) => {
    // The full request URL is provided for routing decisions; a client serving several
    // services can decide per request which credentials apply, or none at all.
    if (new URL(request.url).origin !== "https://proxy.example.com")
      return;

    // The hosting application obtains and refreshes this token through its own channels.
    request.headers.set("Authorization", `Bearer ${myTokenCache.current}`);
    // Query-parameter based schemes are supported the same way:
    // request.searchParams.set("signature", sign(request.url));
  },

  classifyResponse: async (response: MapLayerResponse) => {
    // Recognize failures using the service's own convention. Clone before reading the
    // body so it remains available to the provider.
    if (response.response.status === 401 || response.response.status === 403)
      return "authentication";
    const json = await response.response.clone().json().catch(() => undefined);
    return json?.error?.code === "TOKEN_EXPIRED" ? "authentication" : undefined;
  },
};

IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", proxyAccessClient);
```

### One credential per layer

The access client is registered per format, but [MapLayerRequest.layerUrl]($frontend) identifies the layer each request is made for. Unlike `request.url`, it is stable across every request kind (tiles, tooltips, capabilities, service metadata), so a single client can serve any number of layers of its format, each with its own credentials:

```ts
// Layer URL → token, obtained and refreshed by the hosting application through its own channels.
const tokensByLayer = new Map<string, string>();

IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", {
  getAccessToken: async () => undefined,
  applyToRequest: (request: MapLayerRequest) => {
    const token = tokensByLayer.get(request.layerUrl);
    if (token !== undefined)
      request.headers.set("Authorization", `Bearer ${token}`);
  },
});
```

When `classifyResponse` reports an authentication failure (or a shaped request receives a 401/403 by default), the layer's provider transitions to the [MapLayerImageryProviderStatus]($frontend) member `RequireAuth` and raises [MapLayerImageryProvider.onStatusChanged]($frontend), which applications can use to prompt the user to re-authenticate. How the provider behaves afterwards varies by format: the ArcGIS providers stop requesting tiles while in `RequireAuth`, while the other formats keep requesting new tiles — each still passing through `applyToRequest`, so a client that has silently refreshed its token keeps the layer alive without intervention. Applications should keep monitoring this event even with an access client in place: a client that refreshes its tokens proactively inside `applyToRequest` can make the event rare, but it remains the only signal for failures the client cannot fix silently (revoked access, expired refresh token), and other statuses such as `UntrustedOrigin` flow through it as well.

Once the application has re-established authentication, it must detach and re-attach the layer so that a fresh provider is created: a provider whose initialization failed never obtained the service's capabilities, and tiles that already failed are not re-requested. The same applies to a layer restored from a saved view before its access client was registered — once the client is in place, re-attach the layer.

### Why an access client rather than settings?

Authentication material is deliberately kept out of [ImageMapLayerSettings]($common): settings are serialized into display styles and saved views, so anything stored there is either persisted (a secret leak) or lost when a view is restored (a broken layer). The access client is registered once per session by the hosting application, is consulted at request time, and can refresh its tokens on its own schedule — a restored view works without any per-layer re-injection.

### Interaction with other mechanisms

- **Ordering** — `applyToRequest` runs after the provider has fully assembled the request (protocol parameters, custom query parameters from [ImageMapLayerSettings.savedQueryParams]($common)/[ImageMapLayerSettings.unsavedQueryParams]($common), basic-auth headers, and the ArcGIS `token` parameter when applicable), so the client sees the complete request and its values take precedence. This precedence is unconditional: nothing prevents a client from overwriting protocol parameters such as `REQUEST` or `VERSION`, so a client that injects parameters should use names that cannot collide with the protocols of the formats it is registered for.
- **Coexistence with OAuth-based auth** — both facilities can be implemented by the same client. For example, `ArcGisAccessClient` can be subclassed to add `applyToRequest`, shaping requests to a proxy origin while inheriting OAuth behavior for every other origin.
- **Origin trust and redirects** — requests shaped by `applyToRequest` are treated like credentialed requests by [MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]($frontend): while the restriction is enabled they are issued with `redirect: "error"`, so the injected values cannot silently reach an unlisted origin through a redirect. See [Map-layer security](./MapLayersAndBasemaps.md#map-layer-security).
- **SSO** — a shaped request never triggers the NTLM/Negotiate retry with browser credentials; the access client is the authentication authority for its format. Consequently, layers served by a Windows-Authentication-protected service cannot be used on a format with a shaping client registered: their 401 challenge is classified as an authentication failure (`RequireAuth`) instead of being answered with browser credentials. This applies even to requests the client chooses not to modify.
- **Caching** — when a registered client defines `applyToRequest`, the URL-keyed capability and service-metadata caches are bypassed for that format, so authenticated responses are never shared across differing authentication contexts. This applies to all requests of that format, including those the client chooses not to shape.
- **Backward compatibility** — the contract is strictly opt-in. Without a registered client, or with a client that does not implement `applyToRequest` (such as `ArcGisAccessClient`), requests and failure detection are exactly as in previous releases, driven by the pre-existing status-code checks. Implementing `applyToRequest` opts the shaped requests into the default 401/403 classification above, and implementing `classifyResponse` replaces that default entirely.
