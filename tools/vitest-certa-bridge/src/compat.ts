/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Re-exports matching the exact API surface of @itwin/certa/lib/utils/CallbackUtils.
// Use with resolve.alias in Vite/Vitest config to transparently redirect certa imports.
export { registerBackendCallback, getCallbacksRegisteredOnBackend, executeRegisteredCallback } from "./callbackRegistry";
export { executeBackendCallback } from "./client";
export type { CertaBackendCallback } from "./types";
