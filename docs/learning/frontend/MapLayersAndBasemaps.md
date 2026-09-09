# Map layers, basemaps, and Azure Maps

Azure Maps setup uses the generic map-layer APIs from `@itwin/core-frontend` and the Azure Maps format support from `@itwin/map-layers-formats`.

Use `@itwin/core-frontend` to start the app and attach ordinary background or overlay layers. Use `@itwin/map-layers-formats` to register Azure Maps support, provide the Azure Maps subscription key, and apply Azure basemaps like Street, Aerial, and Hybrid.

## When to use each package

Use `@itwin/core-frontend` for the generic map imagery workflow:

- start `IModelApp`
- provide generic map-layer credentials at startup
- work with a [Viewport]($frontend), [DisplayStyleState]($frontend), and the standard map-layer APIs
- attach additional background or overlay imagery layers

Use `@itwin/map-layers-formats` for Azure Maps-specific behavior:

- `MapLayersFormats.initialize()` to register optional formats and configure the Azure Maps subscription key
- `AzureMaps.applyBackgroundMap(...)` to apply Azure Maps Street, Aerial, or Hybrid basemaps
- `AzureMaps.getBackgroundMapType(...)` to inspect the active Azure Maps basemap type

## Typical setup order

A typical Azure Maps app does three things in order:

1. Start `IModelApp`.
2. Initialize `@itwin/map-layers-formats` with the Azure Maps subscription key so Azure Maps support is registered.
3. Apply an Azure basemap through the `AzureMaps` helper, and then keep using the normal map-layer APIs for any additional layers.

### 1. Start IModelApp

```ts
[[include:AzureMaps_StartIModelApp]]
```

### 2. Register the optional map-layers-formats package and provide the Azure Maps key

```ts
[[include:AzureMaps_InitializeMapLayersFormats]]
```

This step registers the optional Azure Maps format supplied by `@itwin/map-layers-formats` and supplies the subscription key through `azureMapsOpts.subscriptionKey`. Provide the key this way so Azure-specific setup stays with the package that handles Azure Maps.

## Applying Azure Maps basemaps

After startup and registration, apply Azure basemaps through the extension helper:

### Azure Maps Street

```ts
[[include:AzureMaps_BaseMapStreet]]
```

### Azure Maps Aerial

```ts
[[include:AzureMaps_BaseMapAerial]]
```

### Azure Maps Hybrid

```ts
[[include:AzureMaps_BaseMapHybrid]]
```

Hybrid is exposed as one Azure basemap choice even though its internal composition is provider-specific. Applications should request Hybrid through `AzureMaps.applyBackgroundMap(...)` instead of trying to assemble it manually from catalog rows or raw tile URLs.

## Mixing Azure basemaps with normal map layers

Using Azure Maps for the basemap does **not** replace the normal map-layer APIs. After applying an Azure basemap, continue using the regular `DisplayStyleState.attachMapLayer(...)` workflow for additional layers.

For example, an app can apply an Azure aerial basemap and then attach an ordinary overlay layer on top:

```ts
[[include:AzureMaps_BaseMapWithOverlay]]
```

This is the key interleaving model:

- `AzureMaps.applyBackgroundMap(...)` chooses the basemap.
- Standard map-layer APIs add any extra background or overlay content.

## Inspecting the current Azure basemap type

If your UI needs to stay in sync with the active Azure basemap, use the Azure-specific inspection helper:

```ts
[[include:AzureMaps_InspectBaseMapType]]
```

## Choosing between generic and Azure-specific APIs

As a rule of thumb:

- Use generic core APIs when you are managing views, display styles, and ordinary map layers.
- Use `AzureMaps` from `@itwin/map-layers-formats` when you specifically want Azure Maps basemap behavior.

If your app never uses Azure Maps, it does not need to import Azure-specific helpers at all.

## Map-layer security

A map layer is described by a URL, and that URL frequently comes from outside the application: it may be typed by the user, imported from a saved view or settings store, or advertised by a server inside its own capability document. A map-layer provider therefore routinely issues requests to origins the application never explicitly approved, which has two consequences worth designing for: credentials must not be handed to arbitrary origins, and text returned by those origins must not be trusted as markup.

For supplying credentials to services that require them - including custom authentication headers via a fetch handler - see [Map-layer authentication](./MapLayerAuthentication.md).

### Restricting credentials to trusted origins

By default (and historically), map-layer providers send credentials to whatever origin a request happens to target:

- The basic-auth credentials stored in [ImageMapLayerSettings]($common) are attached to every request URL the provider builds.
- An NTLM or Negotiate http 401 challenge from any server triggers a retry with browser credentials included - that is, SSO / Windows Authentication.

Applications can opt in to origin restrictions with two `@beta` properties on [MapLayerFormatRegistry]($frontend):

```ts
IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://tiles.corp.example.com"];
```

When `restrictCredentialsToTrustedOrigins` is enabled:

- Basic-auth credentials are attached only to requests targeting the origin of the layer's settings URL, or an origin listed in `trustedCredentialsOrigins`.
- SSO retries after an NTLM/Negotiate challenge are performed only for origins explicitly listed in `trustedCredentialsOrigins`. Unlike basic-auth, the settings-URL origin is *not* implicitly trusted for SSO, because SSO shares the user's ambient identity while the settings URL itself may come from untrusted input.
- Server-provided tooltip content that is intentionally HTML (see [Server-supplied text](#server-supplied-text) below) is rendered as markup only when it comes from the settings-URL origin or a listed origin.

Entries in `trustedCredentialsOrigins` are normalized to their origin (scheme + host + port); entries that are not `http:` or `https:` URLs are ignored and logged. Opaque schemes - `file:`, `data:`, `about:`, `blob:null` and the custom protocols an Electron host may register - are rejected because they all share the same serialized origin (`"null"`), so trusting one of them would trust every other. For the same reason, a request or settings URL using one of those schemes is never considered to match any origin, and credentials are withheld from it.

The default is `false`, which preserves the legacy behavior. While the restriction is disabled, every request that sends credentials to an origin not listed in `trustedCredentialsOrigins` logs a warning, once per origin - including the capability and service-metadata requests issued during provider initialization and source validation. Applications can use those warnings to discover the set of origins they need to whitelist before opting in.

### Redirects

Because `fetch` follows redirects transparently, an authentication challenge may originate from a different origin than the one requested. All origin-trust decisions therefore target the *final* (post-redirect) URL of the response, and the credential-bearing SSO retry is issued directly to that challenged URL with `redirect: "error"` - a redirect is never a legitimate part of an NTLM/Negotiate handshake, so the retry fails rather than carrying browser credentials to an origin that was not validated. The origin recorded by a successful handshake is likewise the challenged origin, not the requested one.

Subsequent requests to an origin whose handshake succeeded include browser credentials up front. When the restriction is enabled, those requests are issued with `redirect: "error"` as well, so a redirect fails the request instead of carrying credentials to the destination. A browser offers no way to follow same-origin redirects while refusing cross-origin ones, and by the time a followed redirect can be inspected the credentials have already been delivered - so refusing outright is the only way to honour the guarantee that credentials reach none but the listed origins. The cost is that legitimate same-origin redirects on credentialed requests, which some tile servers use, also fail. Configure the layer or request to use the final endpoint directly and list that endpoint's origin in `trustedCredentialsOrigins`, or disable the restriction if redirects are required. Caller-supplied Authorization headers and API tokens do not use this redirect policy.

While the restriction is disabled, credentialed requests keep following redirects, and a cross-origin destination is instead *detected after the fact* and reported by the once-per-origin discovery warning; it is never itself treated as a validated origin. That detection is best-effort only - it cannot undo the exposure, and it does not fire at all when the destination denies CORS, because `fetch` then rejects instead of returning a response. It exists to help applications discover redirect destinations before opting in, not to protect them.

### Reacting to blocked origins

When the origin restriction blocks authentication - that is, a request receives an authentication challenge (http 401) that cannot be answered because credentials were withheld for an untrusted origin, or a request whose basic-auth credentials were withheld is rejected with http 401 or 403 - the provider's status transitions to the [MapLayerImageryProviderStatus]($frontend) member `UntrustedOrigin` (`@beta`) and [MapLayerImageryProvider.onStatusChanged]($frontend) is raised. The blocked origins accumulate in [MapLayerImageryProvider.blockedOrigins]($frontend) (`@beta`), and the event is raised again each time a new origin is blocked. A request whose credentials were withheld but that nonetheless succeeds anonymously does not change the status.

Applications can use this to surface the problem to the user, or to prompt for whitelisting:

```ts
provider.onStatusChanged.addListener((p) => {
  if (p.status === MapLayerImageryProviderStatus.UntrustedOrigin)
    console.warn(`Credentials withheld for untrusted origin(s): ${p.blockedOrigins.join(", ")}`);
});
```

[MapLayerImageryProvider.resetStatus]($frontend) clears the accumulated blocked origins, e.g. after the application has updated `trustedCredentialsOrigins`.

The same distinction is made during provider initialization and source validation: when fetching the capabilities or service metadata of a WMS, WMTS, or ArcGIS layer is blocked by the origin restriction, the provider's status transitions to `UntrustedOrigin` (with the blocked origin recorded in `blockedOrigins`) instead of `RequireAuth`, and [MapLayerFormatRegistry.validateSource]($frontend) returns the [MapLayerSourceStatus]($frontend) member `UntrustedOrigin` (`@beta`) instead of `RequireAuth`. Applications can therefore direct the user to whitelist the origin rather than prompt for credentials that would not help.

### Server-supplied text

Attribution and copyright strings (ArcGIS service metadata, Bing attribution, Google Maps viewport info, Google Photorealistic 3D Tiles copyrights), reality-model tooltips built from tileset batch-table properties, user-supplied layer and model names, and ArcGIS identify results are all inserted as plain text. A malicious or compromised server cannot inject markup or script into the viewport's logo cards, on-screen credits, or map tooltips through them.

One tooltip source intentionally remains HTML: WMS `GetFeatureInfo` responses, which servers may deliberately format as markup. When `restrictCredentialsToTrustedOrigins` is enabled, such markup is honored only from the layer's settings-URL origin or an origin listed in `trustedCredentialsOrigins`, and text from other origins is escaped; at the default setting it is honored from any origin. Note that origin trust is a credential-scoping mechanism, not HTML sanitization - a compromised trusted server can still inject markup, so applications requiring stricter guarantees should sanitize tooltip HTML themselves.

[IModelApp.makeLogoCard]($frontend) is unaffected: string `notice` values may still contain HTML, because applications legitimately use it for their own styled attribution. For text that is not under the application's control, use the `noticeLines` option instead - its string entries are always rendered as plain text with standard logo-card styling, and an `HTMLElement` entry can be supplied for a line that genuinely requires markup.

## Before expecting imagery to appear

Even correctly configured map imagery may still not be visible unless:

- the iModel is geolocated; and
- the view or viewport has background maps enabled.

For more on those prerequisites, see [GeoLocation of iModels](../GeoLocation.md) and [Using Views in iTwin.js](./Views.md).

## Related topics

- [The App Frontend](./index.md)
- [Using Views in iTwin.js](./Views.md)
- [GeoLocation of iModels](../GeoLocation.md)
- [The iTwin.js Display System](../display/index.md)
