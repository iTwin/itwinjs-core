/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AsyncMethodsOf, ExtractLiterals } from "@itwin/core-bentley";

/** Exposed main process methods of dialog module in an Electron app.
 * @beta
 */
export type DialogModuleMethod = ExtractLiterals<AsyncMethodsOf<Electron.Dialog>, "showMessageBox" | "showOpenDialog" | "showSaveDialog">;
