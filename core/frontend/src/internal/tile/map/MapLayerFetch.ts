/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { IModelApp } from "../../../IModelApp";
import { MapLayerRequest } from "../../../tile/internal";

/** Routes an outgoing map-layer request through the [[MapLayerFetchHandler]] registered via
 * [[MapLayerFormatRegistry.setMapLayerFetchHandler]], if any; otherwise issues the default send directly.
 * The handler may pass a copy of the request with other query parameters or headers, call `send` any number
 * of times, short-circuit with its own response, or throw [[MapLayerAuthenticationFailedError]].
 * @internal
 */
export async function fetchMapLayerRequest(args: {
  url: string;
  formatId: string;
  layerUrl: string;
  /** Pre-populated headers (e.g. settings-derived basic auth), if any. */
  headers?: Headers;
  /** The call site's default send. `credentialed` is true when the send may carry handler-injected credentials
   * (every handler send unless it passed [[MapLayerFetchRequestOptions.credentialed]] `false`), false when the
   * request is issued without a handler or the handler declared it untouched.
   */
  send: (request: MapLayerRequest, credentialed: boolean) => Promise<Response>;
}): Promise<Response> {
  const headers = args.headers ?? new Headers();
  const handler = IModelApp.mapLayerFormatRegistry?.mapLayerFetchHandler;
  let parsed: URL | undefined;
  if (handler) {
    try {
      parsed = new URL(args.url);
    } catch {
      // Not a parseable absolute URL; issue the original request unhandled.
    }
  }

  if (!handler || !parsed)
    return args.send({ url: args.url, layerUrl: args.layerUrl, formatId: args.formatId, searchParams: new URLSearchParams(), headers }, false);

  const original = parsed;
  const request: MapLayerRequest = { url: original.toString(), layerUrl: args.layerUrl, formatId: args.formatId, searchParams: original.searchParams, headers };
  return handler(request, async (toSend, options) => {
    // Only the query parameters and headers of the passed request are honored; the target stays ours.
    let url = original;
    if (toSend.searchParams !== request.searchParams) {
      url = new URL(original);
      url.search = toSend.searchParams.toString();
    }
    return args.send({ url: url.toString(), layerUrl: args.layerUrl, formatId: args.formatId, searchParams: toSend.searchParams, headers: toSend.headers }, options?.credentialed ?? true);
  });
}

/** The redirect policy for a credentialed handler send (see [[MapLayerFetchRequest]]): refused while
 * [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled, so handler-injected values
 * cannot silently reach an unlisted origin through a redirect.
 * @internal
 */
export function credentialedFetchRedirect(): RequestRedirect | undefined {
  return IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins ? "error" : undefined;
}
