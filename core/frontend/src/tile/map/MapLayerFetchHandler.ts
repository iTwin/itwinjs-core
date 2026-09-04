/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

/** Describes an outgoing map-layer request submitted to the [[MapLayerFetchHandler]] registered via
 * [[MapLayerFormatRegistry.setMapLayerFetchHandler]]. Treat it as an immutable value: to change what is sent,
 * pass a copy with different [[searchParams]] or [[headers]] to [[MapLayerFetchRequest]], e.g.
 * `fetchRequest({ ...request, headers })`. The target (origin and path) is fixed by us and cannot be
 * changed, so a handler can never (accidentally or otherwise) reroute a request.
 * @beta
 */
export interface MapLayerRequest {
  /** The request URL we built, including its query parameters. Informational: a handler that changes
   * [[searchParams]] does not need to — and cannot — update it.
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

/** Options a [[MapLayerFetchHandler]] passes to [[MapLayerFetchRequest]].
 * @beta
 */
export interface MapLayerFetchRequestOptions {
  /** Whether the send may carry handler-injected credentials. Defaults to `true`: we cannot tell a
   * secret from a benign value, so it protects every handler send unless told otherwise. Pass `false` for a
   * request the handler leaves untouched (e.g. a format it does not manage), so that request keeps the
   * default behavior in full — redirect following and the NTLM/Negotiate SSO retry.
   */
  credentialed?: boolean;
}

/** Issues the default send for a [[MapLayerRequest]] — the equivalent of `base.SendAsync(request)`
 * in an HTTP message-handler pipeline. Applies the site's standard behavior (redirect policy, origin-trust
 * checks, timeouts) and resolves with the response.
 * The request sent is the one passed: its [[MapLayerRequest.searchParams]] and [[MapLayerRequest.headers]] go on
 * the wire, while the target (origin and path) is always that of the request the handler received. May be
 * called several times by a handler (e.g. to retry with a refreshed token).
 *
 * Unless [[MapLayerFetchRequestOptions.credentialed]] is `false`, the send is treated as a credentialed request:
 * redirects are refused while [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled (so
 * injected values cannot silently reach an unlisted origin through a redirect), and an NTLM/Negotiate 401
 * challenge is never answered with browser credentials (SSO). A handler serving one format should therefore
 * pass `{ credentialed: false }` for the others, so their layers (e.g. those served by
 * Windows-Authentication-protected services) are not degraded. We keep protecting the credentials
 * it supplies itself (settings-derived basic auth, browser SSO identity) on every send.
 * @beta
 */
export type MapLayerFetchRequest = (request: MapLayerRequest, options?: MapLayerFetchRequestOptions) => Promise<Response>;

/** Wraps every map-layer network request issued through [[MapLayerImageryProvider]] — tiles, tooltips,
 * capabilities, service metadata, and source validation — like a `DelegatingHandler` wraps `HttpClient` sends.
 * Registered via [[MapLayerFormatRegistry.setMapLayerFetchHandler]]; there is at most one handler per session,
 * owned by the hosting application. Requests a format issues outside the provider's request path (e.g. through
 * its own session or token service client) are not routed; that format's documentation states which.
 *
 * A handler may:
 * - pass a copy of the request with different query parameters or headers to `fetchRequest`;
 * - pass the request through untouched with `fetchRequest(request, { credentialed: false })`, keeping its default
 *   behavior in full;
 * - call `fetchRequest` several times (e.g. refresh an expired token and retry transparently);
 * - return its own `Response` without calling `fetchRequest` (short-circuit);
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
export type MapLayerFetchHandler = (request: MapLayerRequest, fetchRequest: MapLayerFetchRequest) => Promise<Response>;
