/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String, Logger } from "@bentley/bentleyjs-core";
import { IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { EditTools } from "@bentley/imodeljs-editor-frontend";
import { BasicManipulationCommandIpc, editorBuiltInCmdIds } from "@bentley/imodeljs-editor-common";
import { IModelApp, PrimitiveTool, Tool, Viewport } from "@bentley/imodeljs-frontend";

const loggingCategory = "TestPrimitiveTools";

/** If an editing session is currently in progress, end it; otherwise, begin a new one. */
export class EditingSessionTool extends Tool {
  public static toolId = "EditingSession";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 0; }

  public run(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this._run();
    return true;
  }

  private async _run(): Promise<void> {
    const imodel = IModelApp.viewManager.selectedView?.iModel;
    if (!imodel || !imodel.isBriefcaseConnection())
      return;

    const session = imodel.editingSession;
    if (session)
      await session.end();
    else
      await imodel.beginEditingSession();
  }
}

export abstract class PrimitiveToolEx extends PrimitiveTool {
  protected _startedCmd?: string;

  protected async startCommand(): Promise<string> {
    if (undefined !== this._startedCmd)
      return this._startedCmd;
    return EditTools.startCommand<string>(editorBuiltInCmdIds.cmdBasicManipulation, this.iModel.key);
  }

  public static callCommand<T extends keyof BasicManipulationCommandIpc>(method: T, ...args: Parameters<BasicManipulationCommandIpc[T]>): ReturnType<BasicManipulationCommandIpc[T]> {
    return EditTools.callCommand(method, ...args) as ReturnType<BasicManipulationCommandIpc[T]>;
  }

  public get targetCategory(): Id64String {
    if (IModelApp.toolAdmin.activeSettings.category === undefined)
      throw new IModelError(IModelStatus.InvalidCategory, "", Logger.logError, loggingCategory);
    return IModelApp.toolAdmin.activeSettings.category;
  }

  public get targetModelId(): Id64String {
    if (IModelApp.toolAdmin.activeSettings.model === undefined)
      throw new IModelError(IModelStatus.BadModel, "", Logger.logError, loggingCategory);
    return IModelApp.toolAdmin.activeSettings.model;
  }

  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean {
    if (IModelApp.toolAdmin.activeSettings.model === undefined)
      return false;
    return super.isCompatibleViewport(vp, isSelectedViewChange);
  }
}
