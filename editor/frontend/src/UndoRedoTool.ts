/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Editing
 */

import { IModelApp, IpcApp, Tool } from "@itwin/core-frontend";

/** Undo all element changes
 * @beta
 */
export class UndoAllTool extends Tool {
  public static override toolId = "UndoAll";
  public override async run(): Promise<boolean> {
    const imodel = IModelApp.viewManager.selectedView?.view.iModel;
    if (undefined === imodel || imodel.isReadonly || !imodel.isBriefcaseConnection())
      return true;

    if (!await IModelApp.toolAdmin.finishEditCommandForTxnOperation())
      return false;

    return IpcApp.appFunctionIpc.reverseAllTxn(imodel.key).then(() => true).catch(() => false);
  }
}

/** Undo active tool steps, or element changes
 * @beta
 */
export class UndoTool extends Tool {
  public static override toolId = "Undo";
  public override async run(): Promise<boolean> {
    await IModelApp.toolAdmin.doUndoOperation();
    return true;
  }
}

/** Redo active tool steps, or element changes
 * @beta
 */
export class RedoTool extends Tool {
  public static override toolId = "Redo";
  public override async run(): Promise<boolean> {
    await IModelApp.toolAdmin.doRedoOperation();
    return true;
  }
}

