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
  /** True when a fetch handler changed the request's headers or query parameters since it received it, so the
   * send may carry handler-injected credentials; false when the request is exactly as the framework built it.
   */
  credentialed: boolean;
  /** The request headers, including any handler mutations; undefined when the site sends without headers. */
  headers?: Headers;
  /** The request URL, including any handler mutations to the query parameters. */
  url: string;
}

/** Serializes the mutable state a handler may change; Headers iterate sorted and lower-cased, so equal state yields equal strings. */
function fingerprint(url: URL, headers: Headers): string {
  return JSON.stringify([url.search, [...headers]]);
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
    return args.send({ credentialed: false, headers: args.baseHeaders, url: args.url.toString() });

  const headers = args.baseHeaders ?? new Headers();
  // searchParams is a live view: handler mutations are reflected on `url`, and re-read on every send.
  const request: MapLayerRequest = {
    url: args.url.toString(),
    layerUrl: args.layerUrl,
    formatId: args.formatId,
    searchParams: args.url.searchParams,
    headers,
  };
  // A send that is byte-identical to what the framework built carries nothing handler-injected to protect.
  const baseline = fingerprint(args.url, headers);
  return handler(request, async () => args.send({ credentialed: fingerprint(args.url, headers) !== baseline, headers, url: args.url.toString() }));
}

/** The redirect policy for a send that a fetch handler modified (see [[MapLayerFetchNext]]): refused while
 * [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled, so handler-injected values
 * cannot silently reach an unlisted origin through a redirect.
 * @internal
 */
export function credentialedRequestRedirect(): RequestRedirect | undefined {
  return IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins ? "error" : undefined;
}
