/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

/** Describes an outgoing map-layer request submitted to the [[MapLayerFetchHandler]] registered via
 * [[MapLayerFormatRegistry.setMapLayerFetchHandler]].
 * The request target cannot be changed: only its query parameters and headers may be mutated,
 * so a handler can never (accidentally or otherwise) reroute the request to a different origin or path.
 * @beta
 */
export interface MapLayerRequest {
  /** The current request URL — what [[MapLayerFetchNext]] will send — reflecting any mutations made to [[searchParams]]. */
  readonly url: string;
  /** The URL of the map-layer source this request is made for, as configured on the layer's settings.
   * Unlike [[url]], it is stable across every request kind (tiles, tooltips, capabilities, service metadata),
   * making it the key to use when a handler manages distinct values (e.g. credentials) for several layers.
   */
  readonly layerUrl: string;
  /** The id of the map-layer format the request is made for (e.g. "WMS", "ArcGIS"), letting a handler
   * restrict itself to the formats it manages.
   */
  readonly formatId: string;
  /** The complete query-parameter set of the outgoing request — including parameters embedded in the layer's URL
   * and those appended by the provider (e.g. custom query parameters, protocol parameters). May be mutated in
   * place: `searchParams.set("token", ...)` overrides an existing value, `append` adds one. Mutating parameters
   * the provider relies on may break the request. Mutations made between two [[MapLayerFetchNext]] calls are
   * reflected in the second request.
   */
  searchParams: URLSearchParams;
  /** The request headers. May be mutated in place (e.g. `headers.set("Authorization", ...)`). */
  headers: Headers;
}

/** Issues the framework's default send for the current state of a [[MapLayerRequest]] — the equivalent of
 * `base.SendAsync()` in an HTTP message-handler pipeline. Applies the site's standard behavior (redirect
 * policy, origin-trust checks, timeouts) and resolves with the response.
 * May be called several times by a handler (e.g. to retry after refreshing a token); each call re-reads
 * the request's current query parameters and headers.
 *
 * Because only the handler knows whether a value it injected is a secret, every send whose headers or query
 * parameters differ from what the framework built is treated as a credentialed request: redirects are refused
 * while [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled (so injected values cannot
 * silently reach an unlisted origin through a redirect), and an NTLM/Negotiate 401 challenge is never
 * answered with browser credentials (SSO). A send the handler passes through unmodified keeps the default
 * behavior in full — including the SSO retry — so a handler serving one format does not degrade layers of the
 * others (e.g. those served by Windows-Authentication-protected services). The framework keeps protecting the
 * credentials it supplies itself (settings-derived basic auth, browser SSO identity) on every send.
 * @beta
 */
export type MapLayerFetchNext = () => Promise<Response>;

/** Wraps every map-layer network request issued through [[MapLayerImageryProvider]] — tiles, tooltips,
 * capabilities, service metadata, and source validation — like a `DelegatingHandler` wraps `HttpClient` sends.
 * Registered via [[MapLayerFormatRegistry.setMapLayerFetchHandler]]; there is at most one handler per session,
 * owned by the hosting application. Requests a format issues outside the provider's request path (e.g. through
 * its own session or token service client) are not routed; that format's documentation states which.
 *
 * A handler may:
 * - mutate the request's query parameters and headers, then call `next()` for the default behavior;
 * - call `next()` several times (e.g. refresh an expired token and retry transparently);
 * - return its own `Response` without calling `next()` (short-circuit);
 * - throw [[MapLayerAuthenticationFailedError]] to report an unrecoverable authentication failure,
 *   transitioning the layer to [[MapLayerImageryProviderStatus.RequireAuth]].
 *
 * Invoked on the hot path of tile loading; handlers should be fast, cache their tokens internally, and
 * coalesce concurrent refreshes (many tile requests observe an expired token at the same time).
 * While a handler is registered, URL-keyed capability/service-metadata caches are bypassed so that
 * customized responses are never shared across differing request contexts. Note that a single logical
 * operation may invoke the handler more than once (e.g. the ArcGIS providers issue fallback and
 * token-retry requests); each network request passes through the handler individually.
 * @beta
 */
export type MapLayerFetchHandler = (request: MapLayerRequest, next: MapLayerFetchNext) => Promise<Response>;
