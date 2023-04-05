/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AsyncMethodsOf } from "@itwin/core-bentley";

/** @internal */
export const dialogChannel = "electron-dialog";

/** Asynchronous methods of dialog module in an Electron app.
 * @beta
 */
export type DialogModuleMethod = AsyncMethodsOf<Electron.Dialog>;
