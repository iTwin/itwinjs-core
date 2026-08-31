/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import type { MapLayerAccessTokenParams } from "./MapLayerAuthentication";

/** Describes an outgoing map-layer request submitted to [[MapLayerRequestShaper.applyToRequest]].
 * The request target cannot be changed: only its query parameters and headers may be mutated,
 * so a shaper can never (accidentally or otherwise) reroute the request to a different origin or path.
 * @beta
 */
export interface MapLayerRequest {
  /** The request URL, for inspection only (e.g. routing decisions); mutations to [[searchParams]] are not reflected. */
  readonly url: string;
  /** The URL of the map-layer source this request is made for, as configured on the layer's settings.
   * Unlike [[url]], it is stable across every request kind (tiles, tooltips, capabilities, service metadata),
   * making it the key to use when a single shaper manages distinct values (e.g. credentials) for several
   * layers of the same format.
   */
  readonly layerUrl: string;
  /** The complete query-parameter set of the outgoing request — including parameters embedded in the layer's URL
   * and those appended by the provider (e.g. custom query parameters, protocol parameters). May be mutated in
   * place: `searchParams.set("token", ...)` overrides an existing value, `append` adds one. Mutating parameters
   * the provider relies on may break the request.
   */
  searchParams: URLSearchParams;
  /** The request headers. May be mutated in place (e.g. `headers.set("Authorization", ...)`). */
  headers: Headers;
  /** Context identifying the layer the request is made for. */
  context: MapLayerAccessTokenParams;
}

/** Describes a completed map-layer request submitted to [[MapLayerRequestShaper.classifyResponse]].
 * @beta
 */
export interface MapLayerResponse {
  /** The response returned by `fetch`.
   * @note Implementations must not consume the response body directly; call `response.clone()` before reading it
   * so the body remains available to the caller.
   */
  response: Response;
  /** Context identifying the layer the request was made for. */
  context: MapLayerAccessTokenParams;
}

/** A failure recognized by [[MapLayerRequestShaper.classifyResponse]].
 * Currently the only kind is `"authentication"`, which transitions the layer to
 * [[MapLayerImageryProviderStatus.RequireAuth]]; the union may grow in future releases.
 * @beta
 */
export type MapLayerRequestFailure = "authentication";

/** The request-shaping contract of a [[MapLayerAccessClient]]: gives the hosting application full control
 * over the query parameters and headers of every outgoing map-layer request. Authentication (e.g. injecting
 * an `Authorization` header) is the most common use, but any request customization qualifies — correlation
 * headers, API-version parameters, tenant hints. Independent of the token-based (`getAccessToken`) and
 * OAuth (`getTokenServiceEndPoint`/`onOAuthProcessEnd`) facilities.
 * @beta
 */
export interface MapLayerRequestShaper {
  /** When defined, invoked immediately before every request made for a layer whose format this shaper is
   * registered for (tiles, tooltips, capabilities and service metadata), giving the hosting application full
   * control over the request: mutate `searchParams` and/or `headers` in place (e.g. set an `Authorization`
   * header for a service behind an authenticating proxy).
   *
   * Because the injected values may be credentials, requests shaped by this method are treated like
   * credentialed requests by [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]]: while the
   * restriction is enabled, redirects are refused so the injected values cannot silently reach an unlisted
   * origin.
   *
   * When this method is defined, the shaper is the sole authentication authority for its format: a 401
   * challenge on a shaped request is never answered with browser credentials (NTLM / Negotiate SSO), so
   * layers served by Windows-Authentication-protected services cannot be combined with a shaper
   * on the same format.
   *
   * Called on the hot path of tile loading; implementations should be fast and cache their tokens internally.
   * When defined, URL-keyed capability/service-metadata caches are bypassed for this format so that
   * shaped responses are never shared across differing request-shaping contexts.
   * @beta
   */
  applyToRequest?(request: MapLayerRequest): Promise<void> | void;

  /** When defined, invoked after each request that was shaped by [[applyToRequest]] — including responses with a
   * successful HTTP status, since some protocols embed failures in a `200` response — letting the shaper classify
   * the response using whatever convention its protocol uses (status code, embedded error body, redirect target,
   * etc.). Returning `"authentication"` transitions the layer to [[MapLayerImageryProviderStatus.RequireAuth]];
   * returning `undefined` means the shaper recognizes no failure.
   *
   * When omitted, an HTTP 401 or 403 status on a shaped request is treated as an authentication failure; when
   * defined, this method replaces that default entirely.
   * @beta
   */
  classifyResponse?(response: MapLayerResponse): Promise<MapLayerRequestFailure | undefined> | MapLayerRequestFailure | undefined;
}
