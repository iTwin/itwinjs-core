/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { IModelApp } from "../../../IModelApp";
import { MapLayerAccessTokenParams, MapLayerRequest, MapLayerRequestFailure, MapLayerResponse } from "../../../tile/internal";

/** Submits an outgoing map-layer request to the listeners registered via
 * [[MapLayerFormatRegistry.addMapLayerRequestListener]], giving them the opportunity to shape it by
 * mutating the URL's query parameters and `headers` in place.
 * @returns true if the request was shaped by a listener registered with
 * [[MapLayerRequestListenerOptions.injectsCredentials]].
 * @internal
 */
export async function shapeMapLayerRequest(url: URL, headers: Headers, formatId: string, context: MapLayerAccessTokenParams): Promise<boolean> {
  const registry = IModelApp.mapLayerFormatRegistry;
  if (!registry?.hasMapLayerRequestListeners)
    return false;

  // searchParams is a live view: mutations made by listeners are reflected on `url`.
  const request: MapLayerRequest = {
    url: url.toString(),
    layerUrl: context.mapLayerUrl.toString(),
    formatId,
    searchParams: url.searchParams,
    headers,
    context,
  };
  return registry.raiseMapLayerRequest(request);
}

/** Classifies a completed map-layer response by submitting it to the listeners registered via
 * [[MapLayerFormatRegistry.addMapLayerResponseListener]]: [[MapLayerResponse.failure]] is prefilled with
 * the default rule — HTTP 401/403 on a credentialed request — and listeners may overwrite or clear it.
 * @returns true if the response was classified as an authentication failure.
 * @internal
 */
export async function isMapLayerAuthFailure(response: Response, formatId: string, context: MapLayerAccessTokenParams, containsCredentials: boolean): Promise<boolean> {
  const failure: MapLayerRequestFailure | undefined =
    (containsCredentials && (response.status === 401 || response.status === 403)) ? "authentication" : undefined;

  const registry = IModelApp.mapLayerFormatRegistry;
  if (!registry?.hasMapLayerResponseListeners)
    return "authentication" === failure;

  const args: MapLayerResponse = { response, layerUrl: context.mapLayerUrl.toString(), formatId, context, failure };
  await registry.raiseMapLayerResponse(args);
  return "authentication" === args.failure;
}

/** The redirect policy for a request shaped by a listener registered with
 * [[MapLayerRequestListenerOptions.injectsCredentials]]: refused while
 * [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled, so the injected values cannot
 * silently reach an unlisted origin through a redirect.
 * @internal
 */
export function shapedRequestRedirect(): RequestRedirect | undefined {
  return IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins ? "error" : undefined;
}
