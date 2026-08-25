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

/** Registers a simple access client injecting a fixed header (e.g. "Authorization=Bearer ...")
 * and/or query parameters into every map-layer request of the formats listed in
 * IMJS_MAP_LAYER_AUTH_FORMATS. See README.md.
 */
function configureAuthAccessClient(configuration: DtaConfiguration): void {
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
      console.warn(`${envVar} entries must be of the form "name=value"; got "${entry}".`);
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
    console.warn("IMJS_MAP_LAYER_AUTH_FORMATS must list the map-layer format ids (e.g. \"WMS,ArcGIS\") the access client applies to; no access client registered.");
    return;
  }

  for (const formatId of formats) {
    const registered = IModelApp.mapLayerFormatRegistry.setAccessClient(formatId, {
      getAccessToken: async () => undefined,
      applyToRequest: ({ headers, searchParams }) => {
        if (header)
          headers.set(header[0], header[1]);
        for (const [name, value] of queryParams)
          searchParams.set(name, value);
      },
    });
    if (!registered) {
      // eslint-disable-next-line no-console
      console.warn(`IMJS_MAP_LAYER_AUTH_FORMATS: no map-layer format registered with id "${formatId}".`);
    }
  }
}

/** Applies the map-layer security/authentication configuration derived from environment variables.
 * Must be called after IModelApp startup.
 */
export function configureMapLayerAuth(configuration: DtaConfiguration): void {
  configureTrustedCredentialsOrigins(configuration);
  configureAuthAccessClient(configuration);
}
