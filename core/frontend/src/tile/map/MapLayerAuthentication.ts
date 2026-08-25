/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { BeEvent, Listener } from "@itwin/core-bentley";

/** @beta */
export interface MapLayerTokenEndpoint {
  getLoginUrl(stateData?: any): string | undefined;
  getUrl(): string;
}

/** @beta */
export interface MapLayerAuthenticationInfo {
  tokenEndpoint?: MapLayerTokenEndpoint;
}

/** @beta */
export interface MapLayerAccessToken {
  // The generated token.
  token: string;
}

/** @beta */
export interface MapLayerAccessTokenParams {
  /* @deprecated in 5.2.0 - will not be removed until after 2026-10-09. Use `portal` instead */
  mapLayerUrl: URL;

  /**
   * Optional portal URL for ArcGIS services. If set overrides the portal inferred from the mapLayerUrl
   */
  portal?: string;

  // credentials are used to generate non-oauth tokens (i.e ArcGIS legacy tokens)
  userName?: string;
  password?: string;
}

/** Describes an outgoing map-layer request submitted to [[MapLayerAccessClient.applyToRequest]].
 * The request target cannot be changed: only its query parameters and headers may be mutated,
 * so a client can never (accidentally or otherwise) reroute the request to a different origin or path.
 * @beta
 */
export interface MapLayerAuthRequest {
  /** The request URL, for inspection only (e.g. routing decisions); mutations to [[searchParams]] are not reflected. */
  readonly url: string;
  /** The complete query-parameter set of the outgoing request — including parameters embedded in the layer's URL
   * and those appended by the provider (e.g. custom query parameters, protocol parameters). May be mutated in
   * place for query-parameter based authentication: `searchParams.set("token", ...)` overrides an existing value,
   * `append` adds one. Mutating parameters the provider relies on may break the request.
   */
  searchParams: URLSearchParams;
  /** The request headers. May be mutated in place (e.g. `headers.set("Authorization", ...)`). */
  headers: Headers;
  /** Context identifying the layer the request is made for. */
  context: MapLayerAccessTokenParams;
}

/** Describes a completed map-layer request submitted to [[MapLayerAccessClient.isAuthenticationError]].
 * @beta
 */
export interface MapLayerAuthResponse {
  /** The response returned by `fetch`.
   * @note Implementations must not consume the response body directly; call `response.clone()` before reading it
   * so the body remains available to the caller.
   */
  response: Response;
  /** Context identifying the layer the request was made for. */
  context: MapLayerAccessTokenParams;
}

/** The request-shaping contract of a [[MapLayerAccessClient]]: gives the hosting application full control
 * over how map-layer requests are authenticated, independently of the token-based (`getAccessToken`) and
 * OAuth (`getTokenServiceEndPoint`/`onOAuthProcessEnd`) facilities.
 * @beta
 */
export interface MapLayerRequestAuthenticator {
  /** When defined, invoked immediately before every request made for a layer whose format this client is
   * registered for (tiles, tooltips, capabilities and service metadata), giving the hosting application full
   * control over how the request is authenticated: mutate `searchParams` and/or `headers` in place (e.g. set an
   * `Authorization` header for a service behind an authenticating proxy).
   *
   * Requests shaped by this method are treated like credentialed requests by
   * [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]]: while the restriction is enabled, redirects
   * are refused so the injected values cannot silently reach an unlisted origin.
   *
   * When this method is defined, the client is the sole authentication authority for its format: a 401
   * challenge on a shaped request is never answered with browser credentials (NTLM / Negotiate SSO), so
   * layers served by Windows-Authentication-protected services cannot be combined with a shaping client
   * on the same format.
   *
   * Called on the hot path of tile loading; implementations should be fast and cache their tokens internally.
   * When defined, URL-keyed capability/service-metadata caches are bypassed for this format so that
   * authenticated responses are never shared across differing authentication contexts.
   * @beta
   */
  applyToRequest?(request: MapLayerAuthRequest): Promise<void> | void;

  /** When defined, invoked after each request that was shaped by [[applyToRequest]], letting the client decide
   * - using whatever convention its protocol uses (status code, embedded error body, redirect target, etc.) -
   * whether the request failed for authentication reasons. Returning `true` transitions the layer to
   * [[MapLayerImageryProviderStatus.RequireAuth]]. When omitted, an HTTP 401 or 403 status is treated as an
   * authentication failure.
   * @beta
   */
  isAuthenticationError?(response: MapLayerAuthResponse): Promise<boolean> | boolean;
}

/** @beta */
export interface MapLayerAccessClient extends MapLayerRequestAuthenticator {
  getAccessToken(params: MapLayerAccessTokenParams): Promise<MapLayerAccessToken | undefined>;
  getTokenServiceEndPoint?(mapLayerUrl: string): Promise<MapLayerTokenEndpoint | undefined>;
  invalidateToken?(token: MapLayerAccessToken): boolean;

  onOAuthProcessEnd?: BeEvent<Listener>;
}

