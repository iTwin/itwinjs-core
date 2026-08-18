/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { fileURLToPath } from "node:url";
import {
  createElectronBrowserProviderOption,
  type ElectronProviderOptions,
} from "./electron/provider.js";

// The public provider is ESM-only. Its child entry remains an internal CommonJS artifact so
// existing CommonJS backend initialization modules can be loaded without migration wrappers.
const sessionEntryPath = fileURLToPath(new URL("../cjs/electron/provider-session.js", import.meta.url));

/** Create the Electron BrowserProvider option for a Vitest 4 configuration.
 * @internal
 */
export function electron(options: ElectronProviderOptions = {}) {
  return createElectronBrowserProviderOption(options, sessionEntryPath);
}

export type { ElectronProviderOptions };
export default electron;
