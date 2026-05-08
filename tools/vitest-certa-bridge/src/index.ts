/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export { certaBridgePlugin as certaBridge } from "./plugin.js";
export { registerBackendCallback, getCallbacksRegisteredOnBackend } from "./callbackRegistry.js";
export { nullLoader } from "./nullLoader.js";
export { preferEsm } from "./preferEsm.js";
export type { CertaBridgeOptions, CertaBackendCallback, GrepMode } from "./types.js";
