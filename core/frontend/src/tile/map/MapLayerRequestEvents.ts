/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import type { MapLayerAccessTokenParams } from "./MapLayerAuthentication";

/** Describes an outgoing map-layer request submitted to the listeners registered via
 * [[MapLayerFormatRegistry.addMapLayerRequestListener]].
 * The request target cannot be changed: only its query parameters and headers may be mutated,
 * so a listener can never (accidentally or otherwise) reroute the request to a different origin or path.
 * @beta
 */
export interface MapLayerRequest {
  /** The request URL, for inspection only (e.g. routing decisions); mutations to [[searchParams]] are not reflected. */
  readonly url: string;
  /** The URL of the map-layer source this request is made for, as configured on the layer's settings.
   * Unlike [[url]], it is stable across every request kind (tiles, tooltips, capabilities, service metadata),
   * making it the key to use when a single listener manages distinct values (e.g. credentials) for several
   * layers.
   */
  readonly layerUrl: string;
  /** The id of the map-layer format the request is made for (e.g. "WMS", "ArcGIS"), letting a listener
   * restrict itself to the formats it manages.
   */
  readonly formatId: string;
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

/** Describes a completed map-layer request submitted to the listeners registered via
 * [[MapLayerFormatRegistry.addMapLayerResponseListener]].
 * @beta
 */
export interface MapLayerResponse {
  /** The response returned by `fetch`.
   * @note Listeners must not consume the response body directly; call `response.clone()` before reading it
   * so the body remains available to the caller.
   */
  response: Response;
  /** The URL of the map-layer source the request was made for. See [[MapLayerRequest.layerUrl]]. */
  readonly layerUrl: string;
  /** The id of the map-layer format the request was made for. See [[MapLayerRequest.formatId]]. */
  readonly formatId: string;
  /** Context identifying the layer the request was made for. */
  context: MapLayerAccessTokenParams;
  /** The classification of this response. Arrives prefilled with the default rule — `"authentication"` for
   * an HTTP 401/403 response to a credentialed request (see [[MapLayerRequestListenerOptions.injectsCredentials]]),
   * `undefined` otherwise — and listeners may overwrite it (e.g. a protocol-specific failure embedded in a `200`
   * body) or clear it to suppress the default. Whatever value remains after every listener ran is acted upon:
   * `"authentication"` transitions the layer to [[MapLayerImageryProviderStatus.RequireAuth]].
   */
  failure?: MapLayerRequestFailure;
}

/** A failure recognized on [[MapLayerResponse.failure]].
 * Currently the only kind is `"authentication"`, which transitions the layer to
 * [[MapLayerImageryProviderStatus.RequireAuth]]; the union may grow in future releases.
 * @beta
 */
export type MapLayerRequestFailure = "authentication";

/** A listener registered via [[MapLayerFormatRegistry.addMapLayerRequestListener]]. May be asynchronous:
 * each listener is awaited in registration order, and the request is not issued until every listener
 * has completed.
 * @beta
 */
export type MapLayerRequestListener = (request: MapLayerRequest) => Promise<void> | void;

/** A listener registered via [[MapLayerFormatRegistry.addMapLayerResponseListener]]. May be asynchronous:
 * each listener is awaited in registration order, and the response is not classified until every listener
 * has completed.
 * @beta
 */
export type MapLayerResponseListener = (response: MapLayerResponse) => Promise<void> | void;

/** Options describing a [[MapLayerRequestListener]] to [[MapLayerFormatRegistry.addMapLayerRequestListener]].
 * @beta
 */
export interface MapLayerRequestListenerOptions {
  /** Whether the listener injects secrets (an `Authorization` header, an API key, a signed query parameter)
   * into the requests it shapes. Every request submitted to a listener registered with `true` receives
   * credentialed-request handling: redirects are refused while
   * [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled (so the injected values cannot
   * silently reach an unlisted origin), an NTLM/Negotiate 401 challenge is never answered with browser
   * credentials (SSO), and an HTTP 401/403 response is classified as an authentication failure by default
   * (see [[MapLayerResponse.failure]]). This applies even to requests the listener chooses not to modify.
   *
   * A listener injecting only non-secret values (correlation headers, API-version parameters) must register
   * with `false`, preserving the legacy handling of the requests it shapes.
   */
  injectsCredentials: boolean;
}
