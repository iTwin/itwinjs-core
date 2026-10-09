/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export const getTokenCallbackName = "setBackendAccessToken";

declare module "vitest" {
  interface ProvidedContext {
    /** Per-run token for the HTTP callback endpoint; see `backendCallbackTokenKey` in the browser bridge. */
    backendCallbackToken: string;
  }
}
