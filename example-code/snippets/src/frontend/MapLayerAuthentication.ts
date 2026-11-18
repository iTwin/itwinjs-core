/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import { IModelApp, MapLayerAuthenticationFailedError, MapLayerFetchRequest, MapLayerRequest } from "@itwin/core-frontend";

/** Placeholder for the hosting application's own sign-in UI: resolves with a token for the layer, or rejects if the user cancels. */
declare function promptForLayerToken(layerUrl: string): Promise<string>;

// __PUBLISH_EXTRACT_START__ MapLayerAuth_QuickStart
// The only destination allowed to receive the API key.
const proxyOrigin = "https://maps-proxy.example.com";

/** Adds an API-key header to every map-layer request sent to the proxy. Returns the function that removes the handler. */
function addProxyApiKey(apiKey: string): () => void {
  return IModelApp.mapLayerFormatRegistry.addMapLayerFetchHandler(async (request, fetchRequest) => {
    const target = new URL(request.url, document.baseURI);
    if (target.protocol !== "https:" || target.origin !== proxyOrigin)
      return undefined; // not ours: the request keeps its default behavior

    const headers = new Headers(request.headers);
    headers.set("X-Api-Key", apiKey);
    const response = await fetchRequest({ ...request, headers });

    // The handler decides which responses are authentication failures; throwing puts the layer in RequireAuth.
    if (response.status === 401 || response.status === 403)
      throw new MapLayerAuthenticationFailedError(request.url);
    return response;
  });
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ MapLayerAuth_SignInOut
let removeApiKeyHandler: (() => void) | undefined;

function onUserSignedIn(apiKey: string): void {
  removeApiKeyHandler?.(); // replace the handler holding the previous key, if any
  removeApiKeyHandler = addProxyApiKey(apiKey);
}

function onUserSignedOut(): void {
  removeApiKeyHandler?.(); // later requests are sent without the key
  removeApiKeyHandler = undefined;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ MapLayerAuth_RestrictRedirects
function restrictMapLayerCredentials(): void {
  const registry = IModelApp.mapLayerFormatRegistry;
  // Refuse redirects of requests sent through a fetch handler, so injected values cannot follow a redirect elsewhere.
  registry.restrictCredentialsToTrustedOrigins = true;
  // Also restricts the framework's own credentials. List the origins that may receive cross-origin basic auth or
  // SSO (Windows Authentication); for SSO, a layer's own origin is not trusted unless it is listed here.
  registry.trustedCredentialsOrigins = ["https://gis.intranet.example.com"];
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ MapLayerAuth_BearerWithRefresh
// Obtains a fresh token from the hosting application's identity provider, e.g. by running an OAuth2
// client-credentials or refresh-token exchange against the proxy's token endpoint.
async function acquireToken(): Promise<string> {
  const response = await fetch("https://proxy.example.com/oauth/token", { method: "POST" /* , grant parameters */ });
  return (await response.json()).access_token;
}

// Coalesces concurrent refreshes: every request observing the same expired token awaits a single refresh.
class TokenCache {
  public current = "";
  private _refreshing?: Promise<void>;

  public async refresh(expired: string): Promise<void> {
    if (this.current !== expired)
      return; // another request already refreshed it
    this._refreshing ??= acquireToken()
      .then((token) => { this.current = token; })
      .finally(() => { this._refreshing = undefined; });
    return this._refreshing;
  }
}
const proxyTokens = new TokenCache();

// Returns a copy of the request carrying the given bearer token.
function withBearer(request: MapLayerRequest, token: string): MapLayerRequest {
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...request, headers };
}

function addBearerTokenHandler(): () => void {
  return IModelApp.mapLayerFormatRegistry.addMapLayerFetchHandler(async (request: MapLayerRequest, fetchRequest: MapLayerFetchRequest) => {
    const target = new URL(request.url, document.baseURI);
    if (target.protocol !== "https:" || target.origin !== "https://proxy.example.com")
      return undefined; // not ours: leave the request to the next handler, or to the default behavior

    const token = proxyTokens.current;
    let response = await fetchRequest(withBearer(request, token));
    if (response.status === 401) {
      await proxyTokens.refresh(token);
      response = await fetchRequest(withBearer(request, proxyTokens.current)); // transparent retry: no RequireAuth
    }
    if (response.status === 401 || response.status === 403)
      throw new MapLayerAuthenticationFailedError(request.url); // unrecoverable: prompt the user
    return response;
  });
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ MapLayerAuth_PerLayerToken
// Layer URL → token, explicitly assigned by the application for that layer's origin.
const tokensByLayer = new Map<string, string>();

function addPerLayerTokenHandler(): () => void {
  return IModelApp.mapLayerFormatRegistry.addMapLayerFetchHandler(async (request: MapLayerRequest, fetchRequest: MapLayerFetchRequest) => {
    const token = tokensByLayer.get(request.layerUrl);
    if (token === undefined)
      return undefined; // a layer this handler does not manage
    const target = new URL(request.url, document.baseURI);
    const layer = new URL(request.layerUrl, document.baseURI);
    if ((target.protocol !== "https:" && target.protocol !== "http:") || target.origin !== layer.origin)
      return undefined; // do not send this layer's token to another origin

    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetchRequest({ ...request, headers });
    if (response.status === 401 || response.status === 403) {
      requestSignIn(request.layerUrl); // see "Prompting the user to sign in again"
      throw new MapLayerAuthenticationFailedError(request.url);
    }
    return response;
  });
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ MapLayerAuth_PerLayerQueryParams
// Layer URL → secret query parameters, explicitly assigned by the application for that layer's origin.
const secretParamsByLayer = new Map<string, { [key: string]: string }>();

function addPerLayerQueryParamsHandler(): () => void {
  return IModelApp.mapLayerFormatRegistry.addMapLayerFetchHandler(async (request, fetchRequest) => {
    const params = secretParamsByLayer.get(request.layerUrl);
    if (!params)
      return undefined; // a layer this handler does not manage
    const target = new URL(request.url, document.baseURI);
    const layer = new URL(request.layerUrl, document.baseURI);
    if ((target.protocol !== "https:" && target.protocol !== "http:") || target.origin !== layer.origin)
      return undefined; // a server-advertised link must not inherit this layer's secrets

    const searchParams = new URLSearchParams(request.searchParams);
    for (const [name, value] of Object.entries(params))
      searchParams.set(name, value);
    const response = await fetchRequest({ ...request, searchParams });
    if (response.status === 401 || response.status === 403)
      throw new MapLayerAuthenticationFailedError(request.url);
    return response;
  });
}

// Previously: settings.unsavedQueryParams = { apiKey };
function attachLayerWithApiKey(settings: ImageMapLayerSettings, apiKey: string): void {
  secretParamsByLayer.set(settings.url, { apiKey }); // register the secret before the layer issues its first request
  IModelApp.viewManager.selectedView?.displayStyle.attachMapLayer({ settings, mapLayerIndex: { index: -1, isOverlay: false } });
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ MapLayerAuth_Reauthenticate
// Layer URL → sign-in in progress, so many failing tile requests prompt the user only once.
const pendingSignIns = new Map<string, Promise<void>>();

/** Called by a fetch handler just before it throws MapLayerAuthenticationFailedError. */
function requestSignIn(layerUrl: string): void {
  if (pendingSignIns.has(layerUrl))
    return;
  const signIn = promptForLayerToken(layerUrl)
    .then((token) => {
      tokensByLayer.set(layerUrl, token); // the credentials the handler reads
      resetMapLayers(layerUrl);
    })
    .catch(() => { }) // cancelled: the layer stays in RequireAuth
    .finally(() => pendingSignIns.delete(layerUrl));
  pendingSignIns.set(layerUrl, signIn);
}

/** Re-initializes every layer attached from `layerUrl`, discarding tiles that failed while unauthenticated. */
function resetMapLayers(layerUrl: string): void {
  for (const vp of IModelApp.viewManager) {
    const imagery = vp.displayStyle.settings.mapImagery;
    for (const isOverlay of [false, true]) {
      const layers = isOverlay ? imagery.overlayLayers : imagery.backgroundLayers;
      layers.forEach((layer, index) => {
        if (layer instanceof ImageMapLayerSettings && layer.url === layerUrl)
          vp.resetMapLayer({ index, isOverlay });
      });
    }
  }
}
// __PUBLISH_EXTRACT_END__

export {
  addBearerTokenHandler,
  addPerLayerQueryParamsHandler,
  addPerLayerTokenHandler,
  attachLayerWithApiKey,
  onUserSignedIn,
  onUserSignedOut,
  restrictMapLayerCredentials,
};
