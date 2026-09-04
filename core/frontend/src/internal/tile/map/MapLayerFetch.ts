/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { IModelApp } from "../../../IModelApp";
import { MapLayerRequest } from "../../../tile/internal";

/** The outcome of [[fetchMapLayerRequest]].
 * @internal
 */
export interface MapLayerFetchResult {
  response: Response;
  /** True when a [[MapLayerFetchHandler]] returned this response as its own — from a default send it did not
   * declare `{ credentialed: false }`, or by short-circuiting. The framework then applies none of its default
   * response handling (status-code or protocol-error classification into `RequireAuth`, `UntrustedOrigin`, etc.):
   * the handler reports failures by throwing [[MapLayerAuthenticationFailedError]]. False for pass-through
   * responses — no handler registered, or the handler passed the request through with `{ credentialed: false }` —
   * which are exactly what the framework would have obtained on its own and get the default handling.
   */
  managedByHandler: boolean;
}

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
}): Promise<MapLayerFetchResult> {
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

  if (!handler || !parsed) {
    const unhandled = await args.send({ url: args.url, layerUrl: args.layerUrl, formatId: args.formatId, searchParams: new URLSearchParams(), headers }, false);
    return { response: unhandled, managedByHandler: false };
  }

  const original = parsed;
  const request: MapLayerRequest = { url: original.toString(), layerUrl: args.layerUrl, formatId: args.formatId, searchParams: original.searchParams, headers };
  // Responses of pass-through sends: if the handler returns one of them as-is, it did not take it over.
  const passedThrough = new WeakSet<Response>();
  const response = await handler(request, async (toSend, options) => {
    // Only the query parameters and headers of the passed request are honored; the target stays ours.
    let url = original;
    if (toSend.searchParams !== request.searchParams) {
      url = new URL(original);
      url.search = toSend.searchParams.toString();
    }
    const credentialed = options?.credentialed ?? true;
    const sent = await args.send({ url: url.toString(), layerUrl: args.layerUrl, formatId: args.formatId, searchParams: toSend.searchParams, headers: toSend.headers }, credentialed);
    if (!credentialed)
      passedThrough.add(sent);
    return sent;
  });
  return { response, managedByHandler: !passedThrough.has(response) };
}

/** The redirect policy for a credentialed handler send (see [[MapLayerFetchRequest]]): refused while
 * [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled, so handler-injected values
 * cannot silently reach an unlisted origin through a redirect.
 * @internal
 */
export function credentialedFetchRedirect(): RequestRedirect | undefined {
  return IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins ? "error" : undefined;
}
