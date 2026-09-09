/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { DtaConfiguration } from "../common/DtaConfiguration";

/** Restricts map-layer credentials (including SSO / Windows Authentication) to the exact
 * origins listed in IMJS_MAP_LAYER_TRUSTED_CREDENTIALS_ORIGINS. See README.md.
 */
function configureTrustedCredentialsOrigins(configuration: DtaConfiguration): void {
  if (!configuration.mapLayerTrustedCredentialsOrigins)
    return;

  const trustedOrigins: string[] = [];
  for (const entry of configuration.mapLayerTrustedCredentialsOrigins.split(",")) {
    const value = entry.trim();
    if (!value)
      continue;
    try {
      trustedOrigins.push(new URL(value).origin);
    } catch {
      // eslint-disable-next-line no-console
      console.warn(`Ignoring invalid origin in IMJS_MAP_LAYER_TRUSTED_CREDENTIALS_ORIGINS: "${value}"`);
    }
  }

  if (trustedOrigins.length > 0) {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = trustedOrigins;
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
  } else {
    // eslint-disable-next-line no-console
    console.warn("IMJS_MAP_LAYER_TRUSTED_CREDENTIALS_ORIGINS was set but contained no valid origins; leaving restrictCredentialsToTrustedOrigins disabled.");
  }
}

/** Registers a map-layer fetch handler ([[MapLayerFormatRegistry.addMapLayerFetchHandler]]) injecting a
 * fixed header (e.g. "Authorization=Bearer ...") and/or query parameters for IMJS_MAP_LAYER_AUTH_FORMATS.
 * The layer's own origin is allowed; IMJS_MAP_LAYER_AUTH_ORIGINS permits additional destinations. See README.md.
 */
function configureAuthFetchHandler(configuration: DtaConfiguration): void {
  if (!configuration.mapLayerAuthHeader && !configuration.mapLayerAuthQueryParams)
    return;

  // Both variables use "name=value" entries, split on the first "=".
  const parsePair = (entry: string, envVar: string): [string, string] | undefined => {
    const separator = entry.indexOf("=");
    const name = separator > 0 ? entry.slice(0, separator).trim() : "";
    const value = separator > 0 ? entry.slice(separator + 1).trim() : "";
    if (name && value)
      return [name, value];
    if (entry.trim()) {
      // eslint-disable-next-line no-console
      console.warn(`${envVar} entries must be of the form "name=value".`);
    }
    return undefined;
  };

  const header = configuration.mapLayerAuthHeader ? parsePair(configuration.mapLayerAuthHeader, "IMJS_MAP_LAYER_AUTH_HEADER") : undefined;
  const queryParams: Array<[string, string]> = [];
  for (const entry of configuration.mapLayerAuthQueryParams?.split(",") ?? []) {
    const pair = parsePair(entry, "IMJS_MAP_LAYER_AUTH_QUERY_PARAMS");
    if (pair)
      queryParams.push(pair);
  }

  if (!header && queryParams.length === 0)
    return;

  const formats = (configuration.mapLayerAuthFormats ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  if (formats.length === 0) {
    // eslint-disable-next-line no-console
    console.warn("IMJS_MAP_LAYER_AUTH_FORMATS must list the map-layer format ids (e.g. \"WMS,ArcGIS\") the fetch handler applies to; no handler registered.");
    return;
  }

  // Optional additional origins for cross-origin requests; independent of SSO trust.
  const origins = new Set<string>();
  for (const entry of configuration.mapLayerAuthOrigins?.split(",") ?? []) {
    const value = entry.trim();
    if (!value)
      continue;
    try {
      const url = new URL(value);
      if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password
        || url.pathname !== "/" || url.search || url.hash || url.hostname.includes("*"))
        throw new Error("Expected an exact HTTP(S) origin");
      origins.add(url.origin);
    } catch {
      // Do not echo the value: a misconfigured URL could contain credentials.
      // eslint-disable-next-line no-console
      console.warn("Ignoring invalid origin in IMJS_MAP_LAYER_AUTH_ORIGINS; expected an exact HTTP(S) origin (scheme + host + port).");
    }
  }

  for (const formatId of formats) {
    if (!IModelApp.mapLayerFormatRegistry.isRegistered(formatId)) {
      // eslint-disable-next-line no-console
      console.warn(`IMJS_MAP_LAYER_AUTH_FORMATS: no map-layer format registered with id "${formatId}".`);
    }
  }

  IModelApp.mapLayerFormatRegistry.addMapLayerFetchHandler(async (request, fetchRequest) => {
    if (!formats.includes(request.formatId))
      return undefined;   // not ours: leave the request to the next handler or the default behavior
    // Same-origin requests are allowed by default; server-advertised cross-origin links need explicit approval.
    let target: URL;
    let layer: URL;
    try {
      const baseUrl = typeof document !== "undefined" ? document.baseURI : undefined;
      target = new URL(request.url, baseUrl);
      layer = new URL(request.layerUrl, baseUrl);
    } catch {
      return undefined;
    }
    if ((target.protocol !== "https:" && target.protocol !== "http:")
      || (target.origin !== layer.origin && !origins.has(target.origin)))
      return undefined;

    const headers = new Headers(request.headers);
    if (header)
      headers.set(header[0], header[1]);
    const searchParams = new URLSearchParams(request.searchParams);
    for (const [name, value] of queryParams)
      searchParams.set(name, value);
    return fetchRequest({ ...request, headers, searchParams });
  });
}

/** Applies the map-layer security/authentication configuration derived from environment variables.
 * Must be called after IModelApp startup and after every map-layer format the fetch handler targets
 * (including the MapLayersFormats extension formats) has been registered.
 */
export function configureMapLayerAuth(configuration: DtaConfiguration): void {
  configureTrustedCredentialsOrigins(configuration);
  configureAuthFetchHandler(configuration);
}
