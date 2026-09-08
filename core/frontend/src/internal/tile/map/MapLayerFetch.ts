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
  /** True when a [[MapLayerFetchHandler]] returned this response as its own — from a credentialed send or
   * by short-circuiting. The framework then applies none of its default response handling (status-code or
   * protocol-error classification into `RequireAuth`, `UntrustedOrigin`, etc.): the handler reports failures
   * by throwing [[MapLayerAuthenticationFailedError]]. False when no handler managed the request — none is
   * registered, or every one declined — and we issued our own original request, which is exactly what we would
   * have sent without handlers and gets the default handling.
   */
  managedByHandler: boolean;
}

/** Routes an outgoing map-layer request through the pipeline of [[MapLayerFetchHandler]]s registered via
 * [[MapLayerFormatRegistry.addMapLayerFetchHandler]]; issues the default send directly when there is none or
 * every handler declines. A handler may decline, pass a copy of the request with other query parameters or
 * headers to `fetchRequest` (which offers it to the remaining handlers, then sends it credentialed), call it
 * any number of times, short-circuit with its own response, or throw [[MapLayerAuthenticationFailedError]].
 * @internal
 */
export async function fetchMapLayerRequest(args: {
  url: string;
  formatId: string;
  layerUrl: string;
  /** Pre-populated headers (e.g. settings-derived basic auth), if any. */
  headers?: Headers;
  /** The call site's default send. `credentialed` is true when the send may carry handler-injected credentials
   * (every send requested by a handler), false when the request is our own original one (no handler, or all
   * declined).
   */
  send: (request: MapLayerRequest, credentialed: boolean) => Promise<Response>;
}): Promise<MapLayerFetchResult> {
  const headers = args.headers ?? new Headers();
  // Snapshot: registrations changing while a handler awaits must not shift the pipeline of a request in flight.
  const handlers = [...(IModelApp.mapLayerFormatRegistry?.mapLayerFetchHandlers ?? [])];
  let parsed: URL | undefined;
  if (handlers.length > 0) {
    try {
      parsed = new URL(args.url);
    } catch {
      // Not a parseable absolute URL; issue the original request unhandled.
    }
  }

  if (!parsed) {
    const unhandled = await args.send({ url: args.url, layerUrl: args.layerUrl, formatId: args.formatId, searchParams: new URLSearchParams(), headers }, false);
    return { response: unhandled, managedByHandler: false };
  }

  const original = parsed;
  const originalSearch = original.searchParams.toString();
  const request: MapLayerRequest = { url: original.toString(), layerUrl: args.layerUrl, formatId: args.formatId, searchParams: original.searchParams, headers };
  // Copies the mutable fields (Headers/URLSearchParams are not made immutable by `readonly`), so a handler that
  // mutates its request in place and then declines cannot leak the mutation to the next handler or to the default
  // send; the URL is recomputed from the copied query parameters, the target staying ours.
  const snapshot = (source: MapLayerRequest): MapLayerRequest => {
    const searchParams = new URLSearchParams(source.searchParams);
    let url = original;
    if (searchParams.toString() !== originalSearch) {
      url = new URL(original);
      url.search = searchParams.toString();
    }
    return { url: url.toString(), layerUrl: args.layerUrl, formatId: args.formatId, searchParams, headers: new Headers(source.headers) };
  };
  // Offers the request to handlers[index..]: a declined request goes unchanged to the next handler; a request a
  // handler sends is offered to the remaining ones, then issued credentialed.
  const dispatch = async (index: number, toOffer: MapLayerRequest): Promise<Response | undefined> => {
    for (let i = index; i < handlers.length; ++i) {
      const handled = await handlers[i](snapshot(toOffer), async (toSend) => {
        const next = snapshot(toSend);
        return (await dispatch(i + 1, next)) ?? args.send(next, true);
      });
      if (handled)
        return handled;
    }

    return undefined;
  };

  const response = await dispatch(0, request);
  if (response)
    return { response, managedByHandler: true };

  return { response: await args.send(request, false), managedByHandler: false };
}

/** The redirect policy for a credentialed handler send (see [[MapLayerFetchRequest]]): refused while
 * [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled, so handler-injected values
 * cannot silently reach an unlisted origin through a redirect.
 * @internal
 */
export function credentialedFetchRedirect(): RequestRedirect | undefined {
  return IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins ? "error" : undefined;
}
