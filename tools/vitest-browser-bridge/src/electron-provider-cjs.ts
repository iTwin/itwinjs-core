/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as path from "node:path";
import {
  createElectronBrowserProviderOption,
  type ElectronProviderOptions,
} from "./electron/provider.js";

/** Create the Electron BrowserProvider option for a Vitest 4 configuration.
 * @internal
 */
export function electron(options: ElectronProviderOptions = {}) {
  return createElectronBrowserProviderOption(options, path.join(__dirname, "electron", "provider-session.js"));
}

export type { ElectronProviderOptions };
export default electron;
