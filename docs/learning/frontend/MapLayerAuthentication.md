# Map-layer authentication

Map layers frequently target services that require authentication. iTwin.js supports several mechanisms: a token-based facility coordinated through one [MapLayerAccessClient]($frontend) per map-layer format, and a fetch handler on [MapLayerFormatRegistry]($frontend) giving the hosting application full control over every outgoing map-layer request.

An access client is registered on the [MapLayerFormatRegistry]($frontend) for a given format id, and the token-based requests made for a layer of that format consult it:

```ts
IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", myAccessClient);
```

There is exactly one access client per format—registering a new one replaces the previous one.

## OAuth-based authentication

[MapLayerAccessClient.getAccessToken]($frontend) produces a [MapLayerAccessToken]($frontend), typically acquired through a standard OAuth2 flow. The optional members [MapLayerAccessClient.getTokenServiceEndPoint]($frontend) and [MapLayerAccessClient.onOAuthProcessEnd]($frontend) support the interactive login step of that flow. [MapLayerAccessClient.invalidateToken]($frontend) lets the provider discard an expired token so a fresh one is generated.

While token acquisition is pure OAuth2, the token's *delivery* follows the ESRI convention: providers append it to requests as the documented `token` query parameter, so this facility is consumed only by the ArcGIS providers. The `@itwin/map-layers-auth` package provides `ArcGisAccessClient`, a complete implementation supporting ArcGIS OAuth2 as well as legacy (non-OAuth) ArcGIS tokens generated from user credentials.

## The map-layer fetch handler

Some services use authentication schemes the OAuth facility above cannot express. For example:

- an HTTP header such as `Authorization: Bearer …`
- an API-key header (required for example by services exposed through an authenticating proxy)
- a custom query parameter under the hosting application's control
- a computed request signature

For these, the hosting application registers a `@beta` [MapLayerFetchHandler]($frontend) that wraps every map-layer network request—tiles, tooltips, capabilities, service metadata, and source validation—of the WMS, WMTS, TileURL, ArcGIS, ArcGIS Feature, and OGC API Features formats (see [Interaction with other mechanisms](#interaction-with-other-mechanisms) for the requests of other formats).

### Quick start

The most common case is a fixed credential—an API key or a static `Authorization` header—that must reach one map service or proxy, and nothing else. Register the handler once after `IModelApp.startup` (and after `MapLayersFormats.initialize` if you use `@itwin/map-layers-formats`), before the layers it serves issue their first request:

```ts
[[include:MapLayerAuth_QuickStart]]
```

Three things in this handler matter for every handler you write:

1. **Return `undefined` for requests you do not manage.** Compare the request's destination (or its [MapLayerRequest.formatId]($frontend) / [MapLayerRequest.layerUrl]($frontend)) with what you explicitly approved. Declined requests behave exactly as if no handler were registered.
2. **Copy, then send.** Build new `Headers` / `URLSearchParams` from the request, and pass `{ ...request, headers }` or `{ ...request, searchParams }` to `fetchRequest`.
3. **Classify failures yourself.** Throw [MapLayerAuthenticationFailedError]($frontend) for responses that mean "not authenticated"; the layer then reports `RequireAuth` (see [Prompting the user to sign in again](#prompting-the-user-to-sign-in-again)).

`addMapLayerFetchHandler` returns the function that removes the handler. Keep it so you can swap credentials or stop injecting them:

```ts
[[include:MapLayerAuth_SignInOut]]
```

Removing a handler only affects requests issued afterwards: tiles already loaded stay displayed. To reload a layer with the new credentials, reset it as shown in [Prompting the user to sign in again](#prompting-the-user-to-sign-in-again).

Finally, enable the origin-trust restriction so a redirect cannot carry the injected value to another origin:

```ts
[[include:MapLayerAuth_RestrictRedirects]]
```

### How the pipeline works

Handlers form a pipeline owned by the framework and run in registration order, the first registered being the outermost; `addMapLayerFetchHandler` returns the function that removes the handler. Each handler receives the request ([MapLayerRequest]($frontend)) and a `fetchRequest` function ([MapLayerFetchRequest]($frontend)) that sends a request onward: through the remaining handlers, then to the network. It may:

- decline a request it does not manage (e.g. a format it does not serve) by returning `undefined` without calling `fetchRequest`. Each handler receives its own copy of the request, so the next handler sees the request exactly as the declining one received it; if every handler declines, the framework issues it with the default behavior in full
- pass a copy of the request with different query parameters or headers to `fetchRequest` (e.g. `fetchRequest({ ...request, headers })`); the request's target (origin and path) is fixed and cannot be changed. The request is offered to the remaining handlers, which may modify it further or decline, and is then sent as a credentialed request
- call `fetchRequest` one or more times, so a handler can refresh an expired token and retry transparently
- return its own `Response` without calling `fetchRequest` (short-circuit)
- throw [MapLayerAuthenticationFailedError]($frontend) to report an unrecoverable authentication failure

A handler that has called `fetchRequest` must return a response (its own or the one received) or throw; it must not decline. This is not enforced: declining after sending makes the enclosing handler's `fetchRequest` issue the request again.

Handlers run on the hot path of tile loading; they should be fast and cache their tokens internally. Tile requests are issued concurrently, so when a token expires many of them observe the `401` at the same time—a handler that refreshes on `401` must coalesce those refreshes into a single in-flight operation (as `TokenCache` does in [Refreshing an expired token](#refreshing-an-expired-token)), or it will hammer the token endpoint and may invalidate the token it just obtained. A single logical operation may invoke the pipeline more than once (e.g. the ArcGIS providers issue fallback and token-retry requests); each network request passes through it individually.

> **CORS**: in a browser, injecting a non-safelisted header (including `Authorization`) makes cross-origin requests subject to a CORS preflight—the map service (or the proxy in front of it) must list that header in its `Access-Control-Allow-Headers` response, or every request will be blocked by the browser before it is sent. Query parameters are not subject to this requirement.

### Refreshing an expired token

A handler can call `fetchRequest` more than once. This one authenticates layers behind a proxy with a bearer token, and when the proxy answers `401` it refreshes the token and retries, so the layer never reports `RequireAuth` for a merely expired token. Query-parameter schemes work the same way with a copy of `request.searchParams`.

```ts
[[include:MapLayerAuth_BearerWithRefresh]]
```

### Responsibilities: the handler owns what it injects

Registering a handler means owning authentication for the requests it manages—the framework applies no default failure classification to responses the handler returns. Two rules keep the split clear:

- **What the framework injects, the framework protects.** Settings-derived basic auth and the browser's SSO identity keep their origin-trust rules ([MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]($frontend)) on every send, handler or not.
- **What the handler injects, the framework cannot recognize**—so every send issued through `fetchRequest` is a credentialed request: redirects are refused while the trusted-origins restriction is enabled (so injected values cannot silently reach an unlisted origin through a redirect), and an NTLM/Negotiate 401 challenge is never answered with browser credentials (SSO). A handler that does not manage a request therefore declines it (returns `undefined`) instead of sending it, and the request keeps the default behavior in full—this is how a handler serving one format avoids degrading layers of the others.

A handler that fetches on its own instead of calling `fetchRequest` bypasses these protections entirely; it then owns transport security for that request.

### Layered applications

Several layers of an application (e.g. a platform package and the application itself) can each register their own handler without coordinating: the framework owns the pipeline, so no layer needs to know about the others. A request declined by every handler goes out with the default behavior; a request sent by one handler is offered to the handlers registered after it before it is issued, so an inner handler can add its own headers on top of an outer one's—and because the request an outer handler sends is always issued credentialed, no inner handler can downgrade the protection of a value the outer one injected, even by declining.

Because requests are passed along as values, each handler builds its own copy on top of the one it received; none sees another's changes reverted. Header conflicts between handlers (two handlers setting `Authorization` for the same origin) are a configuration error of the hosting application; the inner handler's value wins.

### One credential per layer

The pipeline is global, but [MapLayerRequest.layerUrl]($frontend) identifies the layer each request is made for. Unlike `request.url`, it is stable across every request kind (tiles, tooltips, capabilities, service metadata), so a single handler can serve any number of layers, each with its own credentials. In this example, the application assigns a token to each layer it trusts, and sends that token only to the layer's own HTTP(S) origin. WMTS resource templates and OGC collection links pointing to another origin do not receive it:

```ts
[[include:MapLayerAuth_PerLayerToken]]
```

Also enable `restrictCredentialsToTrustedOrigins` to prevent redirects from forwarding the injected token elsewhere; it does not replace the same-origin check. Serving authenticated tiles or collections from a different origin is an advanced case requiring explicit approval of that destination for the particular credential, not automatic trust in server-advertised links.

### Secret query parameters per layer

Some services expect the key as a query parameter rather than a header. Applications that used the deprecated `unsavedQueryParams` to keep such a key out of saved views should move it into a handler, keyed on the layer URL. The handler appends the parameters only to requests sent to the layer's own origin, and the secret is never written to [ImageMapLayerSettings]($common):

```ts
[[include:MapLayerAuth_PerLayerQueryParams]]
```

Because [MapLayerRequest.layerUrl]($frontend) is also the URL of a [MapLayerSource]($frontend) during validation, the same entry serves the attach dialog's validation request and every later request of the layer. Non-secret parameters that should be saved with the layer belong in [ImageMapLayerSettings.queryParams]($common) instead.

### Prompting the user to sign in again

When the handler throws [MapLayerAuthenticationFailedError]($frontend), the layer's provider transitions to the [MapLayerImageryProviderStatus]($frontend) member `RequireAuth` and raises [MapLayerImageryProvider.onStatusChanged]($frontend), which applications can use to prompt the user to re-authenticate. How the provider behaves afterwards varies by format: the ArcGIS providers stop requesting tiles while in `RequireAuth`, while the other formats keep requesting new tiles—each still routed through the handler, so a handler that refreshes its token keeps the layer alive without intervention. Applications should keep monitoring this event even with a handler in place: transparent retries can make it rare, but it remains the only signal for failures the handler cannot fix silently (revoked access, expired refresh token), and other statuses such as `UntrustedOrigin` flow through it as well.

Once the application has re-established authentication, update the credentials used by the handler and call [Viewport.resetMapLayer]($frontend) with the layer's [MapLayerIndex]($frontend). This disposes the cached tile tree so the next load creates a fresh provider, runs initialization again, and requests tiles afresh. It is necessary when initialization failed before obtaining the service's capabilities, or when tiles have already failed. The same applies to a layer restored from a saved view before the handler was registered—once the handler is in place, reset the layer.

The sample below connects these steps. The per-layer handler above calls `requestSignIn` just before it throws. Many tile requests fail at about the same time, so the sign-in is coalesced per layer. Once the user provides a new token, every layer attached from that URL is reset in every open viewport:

```ts
[[include:MapLayerAuth_Reauthenticate]]
```

`resetMapLayers` resets background and overlay layers only; it does not reload a base map (`displayStyle.backgroundMapBase`).

[MapLayerImageryProvider.resetStatus]($frontend) only clears the status and blocked origins: it neither reruns initialization nor discards failed tiles. A reset using `Viewport.resetMapLayer` creates a new provider, so applications listening directly to the old provider's `onStatusChanged` event must subscribe to the replacement provider when it becomes available.

### Interaction with other mechanisms

- **Ordering**—the handler runs after the provider has fully assembled the request (protocol parameters, custom query parameters from [ImageMapLayerSettings.queryParams]($common), basic-auth headers, and the ArcGIS `token` parameter when applicable), so it sees the complete request and its values take precedence. This precedence is unconditional: nothing prevents a handler from overwriting protocol parameters such as `REQUEST` or `VERSION`, so a handler that injects parameters should use names that cannot collide with the protocols of the formats it targets.
- **Custom query parameters**—[ImageMapLayerSettings.queryParams]($common) is for non-secret parameters, persisted with the layer. The former `unsavedQueryParams` (deprecated) was the only way to append a value without persisting it, but it offered none of the protections above: a value placed there follows redirects and is sent along with an NTLM/Negotiate retry. Secret or per-session parameters belong in a handler, keyed on `layerUrl` when they differ per layer, as shown in [Secret query parameters per layer](#secret-query-parameters-per-layer).
- **Coexistence with OAuth-based auth**—both facilities operate independently. An ArcGIS layer using `ArcGisAccessClient` still has every request routed through the handler, letting it manage requests to a proxy origin while OAuth tokens keep flowing for every other origin.
- **Origin trust and redirects**—every send issued through `fetchRequest` is treated like a credentialed request by [MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]($frontend): while the restriction is enabled it is issued with `redirect: "error"`, so handler-injected values cannot silently reach an unlisted origin through a redirect. See [Map-layer security](./MapLayersAndBasemaps.md#map-layer-security).
- **SSO**—a credentialed send never triggers the NTLM/Negotiate retry with browser credentials; the handler is the authentication authority for every request it manages. Requests every handler declines keep the SSO retry, so layers served by Windows-Authentication-protected services keep working alongside handlers that leave their requests alone.
- **Caching**—while at least one handler is registered, the URL-keyed capability and service-metadata caches are bypassed, so customized responses are never shared across differing request contexts. This applies to all requests, including those every handler declines: every source validation and provider initialization then re-issues its `GetCapabilities` / service-metadata request instead of reusing a cached response.
- **Google Maps**—tile requests are routed through the pipeline, but the session-creation (`createSession`) and viewport-info (attribution) requests issued by `@itwin/map-layers-formats` are not: they target Google's fixed endpoints with the layer's own API key, so there is no proxy or alternate credential for a handler to apply. The session is a framework-owned credential, so a failing tile response still triggers one session refresh and retry even when a handler manages the request; but the framework never gives up on the layer over a response a handler returned as its own. Applications implementing their own `GoogleMapsSessionManager` own those requests entirely.
- **Bing Maps** (deprecated)—tile requests are routed through the pipeline, but the imagery-metadata request issued when the layer initializes is not: it targets Bing's fixed endpoint with the application's own key.
- **Backward compatibility**—handlers are strictly opt-in. Without one, requests and failure detection are exactly as in previous releases, driven by the pre-existing status-code checks. The framework applies no default failure classification to responses a handler returns; recognizing failures—by status code or protocol-specific convention (e.g. an error embedded in a `200` body)—and throwing [MapLayerAuthenticationFailedError]($frontend) is the handler's job.
