/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export interface DtaBooleanConfiguration {
  noDevTools?: boolean;
  noMaximizeWindow?: boolean;
}

/** Parameters for starting display-performance-test-app with a specified initial configuration */
export type DptaEnvConfig = DtaBooleanConfiguration;

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

  return envConfig;
};
