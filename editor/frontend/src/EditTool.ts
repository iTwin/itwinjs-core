/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { getIModelElectronApi } from "@bentley/imodeljs-common";
import { CommandResult, editCommandApi } from "@bentley/imodeljs-editor-common";
import { PrimitiveTool } from "@bentley/imodeljs-frontend";

export class EditTool extends PrimitiveTool {

  private ipc
  public onRestartTool() { }

  public static async startCommand<Arg, Result>(commandId: string, args?: Arg) {
    return await getIModelElectronApi()!.invoke(editCommandApi.start, { commandId, args }) as CommandResult<Result>;
  }

  public static async callCommand<Arg, Result>(name: string, args?: Arg) {
    return await getIModelElectronApi()!.invoke(editCommandApi.call, { name, args }) as CommandResult<Result>;
  }
}
