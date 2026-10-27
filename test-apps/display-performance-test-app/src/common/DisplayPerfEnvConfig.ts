/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export interface DtaBooleanConfiguration {
  noDevTools?: boolean;
  noMaximizeWindow?: boolean;
}

/** Parameters for starting display-performance-test-app with a specified initial configuration */
export interface DptaEnvConfig extends DtaBooleanConfiguration {
  /** Prefix of the api.bentley.com host, e.g. "qa-" or "dev-". */
  urlPrefix?: string;
  /** The backend signs in headlessly (or uses an existing token) and supplies the access token to the frontend. */
  oidcHeadless?: boolean;
}

let envConfig: DptaEnvConfig | undefined;

/** Parses a DptaEnvConfig out of the environment (i.e. `process.env`)
 * Note: This method can be run on both the backend and the frontend.
 */
export const getConfig = (): DptaEnvConfig => {

  envConfig = {};
  if (undefined !== process.env.IMJS_NO_DEV_TOOLS)
    envConfig.noDevTools = true;
  if (undefined !== process.env.IMJS_NO_MAXIMIZE_WINDOW)
    envConfig.noMaximizeWindow = true;
  if (process.env.IMJS_URL_PREFIX)
    envConfig.urlPrefix = process.env.IMJS_URL_PREFIX;
  if (process.env.IMJS_OIDC_HEADLESS || process.env.DPTA_ACCESS_TOKEN)
    envConfig.oidcHeadless = true;

  return envConfig;
};
