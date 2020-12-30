/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { CommandResult, editCommandApi } from "@bentley/imodeljs-editor-common";
import { FrontendIpc, IModelConnection, PrimitiveTool } from "@bentley/imodeljs-frontend";

/** @alpha */
export class EditTool extends PrimitiveTool {

  public onRestartTool() { }

  public static async startCommand<Arg, Result>(commandId: string, connection: IModelConnection, args?: Arg) {
    return await FrontendIpc.ipc.invoke(editCommandApi.start, { iModelKey: connection.key, commandId, args }) as CommandResult<Result>;
  }

  public static async callCommand<Arg, Result>(name: string, args?: Arg) {
    return await FrontendIpc.ipc.invoke(editCommandApi.call, { name, args }) as CommandResult<Result>;
  }
}
