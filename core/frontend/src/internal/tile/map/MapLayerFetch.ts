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
 * The handler may mutate the request's query parameters and headers, call `send` any number of times (each
 * call sees their current state), short-circuit with its own response, or throw
 * [[MapLayerAuthenticationFailedError]].
 * @internal
 */
export async function fetchMapLayerRequest(args: {
  url: string;
  formatId: string;
  layerUrl: string;
  /** Pre-populated headers (e.g. settings-derived basic auth), if any. */
  headers?: Headers;
  /** The call site's default send. `credentialed` is true when the send may carry handler-injected credentials
   * (every handler send unless it passed [[MapLayerFetchNextOptions.credentialed]] `false`), false when the
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

  const url = parsed;
  // searchParams is a live view: handler mutations are reflected on `url`, and seen by every send.
  const request: MapLayerRequest = {
    get url() { return url.toString(); },
    layerUrl: args.layerUrl,
    formatId: args.formatId,
    searchParams: url.searchParams,
    headers,
  };
  return handler(request, async (options) => args.send(request, options?.credentialed ?? true));
}

/** The redirect policy for a send that a fetch handler modified (see [[MapLayerFetchNext]]): refused while
 * [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled, so handler-injected values
 * cannot silently reach an unlisted origin through a redirect.
 * @internal
 */
export function credentialedFetchRedirect(): RequestRedirect | undefined {
  return IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins ? "error" : undefined;
}
