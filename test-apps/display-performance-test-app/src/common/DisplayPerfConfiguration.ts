/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export interface DptaStringConfiguration {
  frontendTilesUrlTemplate?: string; // if set, specifies url for @itwin/frontend-tiles to obtain tile trees for spatial views.  See README.md
}

/** Parameters for starting display-performance-test-app with a specified initial configuration */
export type DptaEnvConfig = DptaStringConfiguration;

let envConfig: DptaEnvConfig | undefined;

/** Parses a DptaEnvConfig out of the environment (i.e. `process.env`)
 * Note: This method can be run on both the backend and the frontend.
 */
export const getConfig = (): DptaEnvConfig => {

  envConfig = {};
  envConfig.frontendTilesUrlTemplate = process.env.IMJS_FRONTEND_TILES_URL_TEMPLATE;

  return envConfig;
};
