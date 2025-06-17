/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { AsyncMethodsOf } from "@itwin/core-bentley";

/** @internal */
export const electronIpcStrings = {
  dialogChannel: "itwinjs-electron/dialog",
} as const;

/** Asynchronous methods of dialog module in an Electron app.
 * @beta
 * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use `Electron.Dialog` from `electron` instead.
 */
export type DialogModuleMethod = AsyncMethodsOf<Electron.Dialog>;
