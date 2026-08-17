/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { fileURLToPath } from "node:url";
import {
  createElectronBrowserProviderOption,
  type ElectronProviderOptions,
} from "./electron/provider.js";

// Electron launches the CommonJS main-process entry. The ESM provider is loaded by Vitest,
// but the child process must not depend on Electron's ESM entrypoint handling.
const sessionEntryPath = fileURLToPath(new URL("../cjs/electron/provider-session.js", import.meta.url));

/** Create the Electron BrowserProvider option for a Vitest 4 configuration.
 * @internal
 */
export function electron(options: ElectronProviderOptions = {}) {
  return createElectronBrowserProviderOption(options, sessionEntryPath);
}

export type { ElectronProviderOptions };
export default electron;
