/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { IpcInterface, iTwinChannel } from "@bentley/imodeljs-common";

export const editorAppChannel = iTwinChannel("editor");
export const editorAppIpcVersion = "1.0.0";

/** @alpha */
export type CommandError =
  "CommandNotFound" |
  "Exception" |
  "MethodNotFound" |
  "NoActiveCommand";

/** @alpha */
export interface EditorAppIpc extends IpcInterface {
  startCommand: (commandId: string, iModelKey: string, ...args: any[]) => Promise<any>;
  callMethod: (name: string, ...args: any[]) => Promise<any>;
}

/** @alpha */
export interface EditCommandIpc {
  ping: () => Promise<{ commandId: string, version: string, [propName: string]: any }>;
}
