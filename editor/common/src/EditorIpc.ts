/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

/** @internal */
export const editorIpcStrings = {
  channel: "editor",
  commandBusy: "EditCommandBusy",
} as const;

/** @beta */
export interface EditorIpc {
  startCommand: (commandId: string, iModelKey: string, ...args: any[]) => Promise<any>;
  callMethod: (name: string, ...args: any[]) => Promise<any>;
}

/** @beta */
export interface EditCommandIpc {
  ping: () => Promise<{ commandId: string, version: string, [propName: string]: any }>;
}
