/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { IModelApp } from "../../../IModelApp";
import { MapLayerAccessClient, MapLayerAccessTokenParams } from "../../../tile/internal";

/** Gives an access client's [[MapLayerRequestAuthenticator.applyToRequest]] the opportunity to authenticate an
 * outgoing map-layer request, mutating the URL's query parameters and `headers` in place.
 * @returns true if the request was shaped by the access client.
 * @internal
 */
export async function applyAccessClientToRequest(url: URL, headers: Headers, context: MapLayerAccessTokenParams, accessClient?: MapLayerAccessClient): Promise<boolean> {
  if (!accessClient?.applyToRequest)
    return false;

  // searchParams is a live view: mutations made by the client are reflected on `url`.
  await accessClient.applyToRequest({ url: url.toString(), layerUrl: context.mapLayerUrl.toString(), searchParams: url.searchParams, headers, context });
  return true;
}

/** Returns true if the given response represents an authentication failure for a request shaped by
 * [[MapLayerRequestAuthenticator.applyToRequest]]. Delegates to
 * [[MapLayerRequestAuthenticator.isAuthenticationError]] when defined; otherwise treats HTTP 401/403 as
 * authentication failures.
 * @internal
 */
export async function isAccessClientAuthFailure(response: Response, context: MapLayerAccessTokenParams, accessClient?: MapLayerAccessClient): Promise<boolean> {
  if (accessClient?.isAuthenticationError)
    return accessClient.isAuthenticationError({ response, context });

  return response.status === 401 || response.status === 403;
}

/** The redirect policy for a request shaped by [[MapLayerRequestAuthenticator.applyToRequest]]: refused while
 * [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled, so the injected values cannot
 * silently reach an unlisted origin through a redirect.
 * @internal
 */
export function accessClientRedirect(): RequestRedirect | undefined {
  return IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins ? "error" : undefined;
}
