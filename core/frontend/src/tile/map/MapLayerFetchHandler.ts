/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

/** Describes an outgoing map-layer request submitted to the [[MapLayerFetchHandler]]s registered via
 * [[MapLayerFormatRegistry.addMapLayerFetchHandler]]. Treat it as an immutable value: to change what is sent,
 * pass a copy with different [[searchParams]] or [[headers]] to [[MapLayerFetchRequest]], e.g.
 * `fetchRequest({ ...request, headers })`. The target (origin and path) is fixed by us and cannot be
 * changed, so a handler can never (accidentally or otherwise) reroute a request.
 * @beta
 */
export interface MapLayerRequest {
  /** The request URL, including its query parameters. Informational: a handler that changes
   * [[searchParams]] does not need to — and cannot — update it; we recompute it for the next handler.
   */
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
   * and those appended by the provider (e.g. custom query parameters, protocol parameters). To send different
   * parameters, pass a copy: `const searchParams = new URLSearchParams(request.searchParams); searchParams.set("token", ...)`.
   * Overriding parameters the provider relies on may break the request.
   */
  readonly searchParams: URLSearchParams;
  /** The request headers we supply (e.g. settings-derived basic auth). To send different headers,
   * pass a copy: `const headers = new Headers(request.headers); headers.set("Authorization", ...)`.
   */
  readonly headers: Headers;
}

/** Sends a [[MapLayerRequest]] — the equivalent of `base.SendAsync(request)` in an HTTP message-handler
 * pipeline. The request is first offered to the [[MapLayerFetchHandler]]s registered after the calling one,
 * which may modify it further or decline; once the pipeline is exhausted we issue it with the site's standard
 * behavior (origin-trust checks, timeouts) and resolve with the response.
 * The request sent is the one passed: its [[MapLayerRequest.searchParams]] and [[MapLayerRequest.headers]] go on
 * the wire, while the target (origin and path) is always that of the request the handler received. May be
 * called several times by a handler (e.g. to retry with a refreshed token).
 *
 * Every send is a credentialed request, because only the handler knows whether a value it injected is a secret:
 * redirects are refused while [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled (so
 * injected values cannot silently reach an unlisted origin through a redirect), and an NTLM/Negotiate 401
 * challenge is never answered with browser credentials (SSO). A handler that does not manage a request must
 * therefore not send it but decline it (return `undefined`), so the request keeps its default behavior in
 * full — e.g. layers served by Windows-Authentication-protected services are not degraded by a handler
 * serving another format. We keep protecting the credentials we supply ourselves (settings-derived basic
 * auth, browser SSO identity) on every send.
 * @beta
 */
export type MapLayerFetchRequest = (request: MapLayerRequest) => Promise<Response>;

/** Wraps every map-layer network request issued through [[MapLayerImageryProvider]] — tiles, tooltips,
 * capabilities, service metadata, and source validation — like a `DelegatingHandler` wraps `HttpClient` sends.
 * Registered via [[MapLayerFormatRegistry.addMapLayerFetchHandler]]. Handlers form a pipeline we own, run in
 * registration order: the first registered is the outermost. Requests a format issues outside the provider's
 * request path (e.g. through its own session or token service client) are not routed; that format's
 * documentation states which.
 *
 * A handler may:
 * - decline a request it does not manage (e.g. a format it does not serve) by returning `undefined` without
 *   calling `fetchRequest`: the request is offered unchanged to the next handler, and if every handler declines
 *   we issue it ourselves with the default behavior in full;
 * - pass a copy of the request with different query parameters or headers to `fetchRequest`; the request is
 *   offered to the remaining handlers, then issued as a credentialed send;
 * - call `fetchRequest` several times (e.g. refresh an expired token and retry transparently);
 * - return its own `Response` without calling `fetchRequest` (short-circuit);
 * - throw [[MapLayerAuthenticationFailedError]] to report an unrecoverable authentication failure,
 *   transitioning the layer to [[MapLayerImageryProviderStatus.RequireAuth]].
 *
 * A handler that called `fetchRequest` must return a response (its own or the one received): declining after
 * sending makes the enclosing handler's `fetchRequest` issue the request again.
 *
 * Invoked on the hot path of tile loading; handlers should be fast, cache their tokens internally, and
 * coalesce concurrent refreshes (many tile requests observe an expired token at the same time).
 * While a handler is registered, URL-keyed capability/service-metadata caches are bypassed so that
 * customized responses are never shared across differing request contexts. Note that a single logical
 * operation may invoke the pipeline more than once (e.g. the ArcGIS providers issue fallback and
 * token-retry requests); each network request passes through it individually.
 * @beta
 */
export type MapLayerFetchHandler = (request: MapLayerRequest, fetchRequest: MapLayerFetchRequest) => Promise<Response | undefined>;
