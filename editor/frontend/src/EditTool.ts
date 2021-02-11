/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { editorChannel } from "@bentley/imodeljs-editor-common";
import { IpcApp, PrimitiveTool } from "@bentley/imodeljs-frontend";

/** @alpha TODO: Make namespace instead of PrimitiveTool sub-class, ex. InputCollector for modify handles is an edit tool...
*/
export abstract class EditTool extends PrimitiveTool {
  public static async startCommand<T>(commandId: string, iModelKey: string, ...args: any[]): Promise<T> {
    return IpcApp.callIpcChannel(editorChannel, "startCommand", commandId, iModelKey, ...args) as Promise<T>;
  }

  public static async callCommand(methodName: string, ...args: any[]): Promise<any> {
    return IpcApp.callIpcChannel(editorChannel, "callMethod", methodName, ...args);
  }
}
