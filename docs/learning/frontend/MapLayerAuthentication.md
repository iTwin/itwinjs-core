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

Some services use authentication schemes the OAuth facility above cannot express: an HTTP header such as `Authorization: Bearer …` or an API-key header (required for example by services exposed through an authenticating proxy), a custom query parameter under the hosting application's control, or a computed request signature. For these, an access client implements the [MapLayerRequestAuthenticator]($frontend) contract, which gives the hosting application full control over both the headers and the query parameters of each outgoing request, and applies to **every** map-layer format:

- [MapLayerRequestAuthenticator.applyToRequest]($frontend) is invoked immediately before every request made for a layer of the registered format — tiles, tooltips, capabilities, service metadata, and source validation — and may mutate the request's query parameters and headers in place. The request's target (origin and path) cannot be changed.
- [MapLayerRequestAuthenticator.isAuthenticationError]($frontend) is invoked after each request that `applyToRequest` shaped, letting the client recognize authentication failures using whatever convention its protocol uses. When omitted, HTTP 401/403 responses are treated as authentication failures.

A complete client authenticating layers behind a proxy:

```ts
const proxyAccessClient: MapLayerAccessClient = {
  // Not used by this client; required member of MapLayerAccessClient.
  getAccessToken: async () => undefined,

  applyToRequest: (request: MapLayerAuthRequest) => {
    // The full request URL is provided for routing decisions; a client serving several
    // services can decide per request which credentials apply, or none at all.
    if (new URL(request.url).origin !== "https://proxy.example.com")
      return;

    // The hosting application obtains and refreshes this token through its own channels.
    request.headers.set("Authorization", `Bearer ${myTokenCache.current}`);
    // Query-parameter based schemes are supported the same way:
    // request.searchParams.set("signature", sign(request.url));
  },

  isAuthenticationError: async (response: MapLayerAuthResponse) => {
    // Recognize failures using the service's own convention. Clone before reading the
    // body so it remains available to the provider.
    if (response.response.status === 401 || response.response.status === 403)
      return true;
    const json = await response.response.clone().json().catch(() => undefined);
    return json?.error?.code === "TOKEN_EXPIRED";
  },
};

IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", proxyAccessClient);
```

When `isAuthenticationError` reports a failure (or a shaped request receives a 401/403 by default), the layer's provider transitions to the [MapLayerImageryProviderStatus]($frontend) member `RequireAuth` and raises [MapLayerImageryProvider.onStatusChanged]($frontend), which applications can use to prompt the user to re-authenticate. Applications should keep monitoring this event even with an access client in place: a client that refreshes its tokens proactively inside `applyToRequest` can make the event rare, but it remains the only signal for failures the client cannot fix silently (revoked access, expired refresh token), and other statuses such as `UntrustedOrigin` flow through it as well.

Once the application has re-established authentication, it must detach and re-attach the layer so that a fresh provider is created: a provider whose initialization failed never obtained the service's capabilities, and tiles that already failed are not re-requested. The same applies to a layer restored from a saved view before its access client was registered — once the client is in place, re-attach the layer.

### Why an access client rather than settings?

Authentication material is deliberately kept out of [ImageMapLayerSettings]($common): settings are serialized into display styles and saved views, so anything stored there is either persisted (a secret leak) or lost when a view is restored (a broken layer). The access client is registered once per session by the hosting application, is consulted at request time, and can refresh its tokens on its own schedule — a restored view works without any per-layer re-injection.

### Interaction with other mechanisms

- **Ordering** — `applyToRequest` runs after the provider has fully assembled the request (protocol parameters, custom query parameters from [ImageMapLayerSettings.savedQueryParams]($common)/[ImageMapLayerSettings.unsavedQueryParams]($common), basic-auth headers, and the ArcGIS `token` parameter when applicable), so the client sees the complete request and its values take precedence. This precedence is unconditional: nothing prevents a client from overwriting protocol parameters such as `REQUEST` or `VERSION`, so a client that injects parameters should use names that cannot collide with the protocols of the formats it is registered for.
- **Coexistence with OAuth-based auth** — both facilities can be implemented by the same client. For example, `ArcGisAccessClient` can be subclassed to add `applyToRequest`, shaping requests to a proxy origin while inheriting OAuth behavior for every other origin.
- **Origin trust and redirects** — requests shaped by `applyToRequest` are treated like credentialed requests by [MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]($frontend): while the restriction is enabled they are issued with `redirect: "error"`, so the injected values cannot silently reach an unlisted origin through a redirect. See [Map-layer security](./MapLayersAndBasemaps.md#map-layer-security).
- **SSO** — a shaped request never triggers the NTLM/Negotiate retry with browser credentials; the access client is the authentication authority for its format.
- **Caching** — when a registered client defines `applyToRequest`, the URL-keyed capability and service-metadata caches are bypassed for that format, so authenticated responses are never shared across differing authentication contexts. This applies to all requests of that format, including those the client chooses not to shape.
- **Backward compatibility** — the contract is strictly opt-in. Without a registered client, or with a client that does not implement `applyToRequest` (such as `ArcGisAccessClient`), requests and failure detection are exactly as in previous releases, driven by the pre-existing status-code checks. Implementing `applyToRequest` opts the shaped requests into the default 401/403 classification above, and implementing `isAuthenticationError` replaces that default entirely.
