/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { ipcRenderer } from "electron";
import { getIModelElectronApi } from "@bentley/imodeljs-common";
import { CommandResult, editCommandApi } from "@bentley/imodeljs-editor-common";
import { PrimitiveTool } from "@bentley/imodeljs-frontend";

export class EditTool extends PrimitiveTool {

  private static _ipc: (api: string, ...args: any[]) => Promise<any>;
  private static get ipc() {
    if (undefined === this._ipc)
      this._ipc = (getIModelElectronApi() ?? ipcRenderer).invoke; // ipcRenderer is needed only for tests where node integration is on.
    return this._ipc;
  }

  public onRestartTool() { }

  public static async startCommand<Arg, Result>(commandId: string, args?: Arg) {
    return await this.ipc(editCommandApi.start, { commandId, args }) as CommandResult<Result>;
  }

  public static async callCommand<Arg, Result>(name: string, args?: Arg) {
    return await this.ipc(editCommandApi.call, { name, args }) as CommandResult<Result>;
  }
}
