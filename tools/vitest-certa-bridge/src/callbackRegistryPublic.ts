/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Public-only barrel for the ./callbackRegistry subpath export.
// Exposes only the consumer-facing API; internal helpers (executeRegisteredCallback,
// clearCallbacks, dispatchCallback) are intentionally omitted.
export { registerBackendCallback, getCallbacksRegisteredOnBackend } from "./callbackRegistry.js";
