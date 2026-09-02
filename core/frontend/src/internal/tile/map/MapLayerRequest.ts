/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { IModelApp } from "../../../IModelApp";
import { MapLayerRequest } from "../../../tile/internal";

/** The state a call site's default send receives for each [[MapLayerFetchNext]] invocation.
 * @internal
 */
export interface MapLayerSendArgs {
  /** True when the send was issued through a fetch handler, opting it into credentialed-request handling. */
  viaHandler: boolean;
  /** The request headers, including any handler mutations; undefined when the site sends without headers. */
  headers?: Headers;
  /** The request URL, including any handler mutations to the query parameters. */
  url: string;
}

/** Routes an outgoing map-layer request through the [[MapLayerFetchHandler]] registered via
 * [[MapLayerFormatRegistry.setMapLayerFetchHandler]], if any; otherwise issues the default send directly.
 * The handler may mutate `url`'s query parameters and `headers`, call `send` any number of times (each
 * call re-reads their current state), short-circuit with its own response, or throw
 * [[MapLayerAuthenticationFailedError]].
 * @internal
 */
export async function fetchMapLayerRequest(args: {
  url: URL;
  formatId: string;
  layerUrl: string;
  /** Pre-populated headers (e.g. settings-derived basic auth), if any. */
  baseHeaders?: Headers;
  /** The call site's default send, reading the current request state from the supplied [[MapLayerSendArgs]]. */
  send: (sendArgs: MapLayerSendArgs) => Promise<Response>;
}): Promise<Response> {
  const handler = IModelApp.mapLayerFormatRegistry?.mapLayerFetchHandler;
  if (!handler)
    return args.send({ viaHandler: false, headers: args.baseHeaders, url: args.url.toString() });

  const headers = args.baseHeaders ?? new Headers();
  // searchParams is a live view: handler mutations are reflected on `url`, and re-read on every send.
  const request: MapLayerRequest = {
    url: args.url.toString(),
    layerUrl: args.layerUrl,
    formatId: args.formatId,
    searchParams: args.url.searchParams,
    headers,
  };
  return handler(request, async () => args.send({ viaHandler: true, headers, url: args.url.toString() }));
}

/** The redirect policy for a send issued through a fetch handler (see [[MapLayerFetchNext]]): refused while
 * [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled, so handler-injected values
 * cannot silently reach an unlisted origin through a redirect.
 * @internal
 */
export function credentialedRequestRedirect(): RequestRedirect | undefined {
  return IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins ? "error" : undefined;
}
