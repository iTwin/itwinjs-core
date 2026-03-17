/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export { certaBridgePlugin as certaBridge } from "./plugin.js";
export { registerBackendCallback, getCallbacksRegisteredOnBackend } from "./callbackRegistry.js";
export type { CertaBridgeOptions, CertaBackendCallback, BridgeRequest, BridgeResponse } from "./types.js";
