/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String, Logger } from "@bentley/bentleyjs-core";
import { IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { ElementEditor3d, IModelApp, PrimitiveTool, Viewport } from "@bentley/imodeljs-frontend";

const loggingCategory = "TestPrimitiveTools";

export abstract class PrimitiveToolEx extends PrimitiveTool {
  private _editorConnection?: ElementEditor3d;

  public async ensureEditorConnection() {
    if (this._editorConnection !== undefined)
      return;
    this._editorConnection = await ElementEditor3d.start(this.iModel);
  }

  public get editorConnection(): ElementEditor3d {
    if (this._editorConnection === undefined)
      throw new IModelError(IModelStatus.NotOpen, "", Logger.logError, loggingCategory);
    return this._editorConnection;
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

  public isCompatibleViewport(vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean {
    if (IModelApp.toolAdmin.activeSettings.model === undefined)
      return false;
    if (vp === undefined || !vp.viewsModel(this.targetModelId))
      return false;
    return true;
  }

  public run(): boolean {
    this.targetView = IModelApp.viewManager.selectedView;   // TODO: Where should this happen??
    super.run(); // calls onPostInstall
    return true;
  }

  public onCleanup() {
    if (this._editorConnection === undefined)
      return;
    this._editorConnection.end()
      .then(() => {
        this._editorConnection = undefined;
      })
      .catch((err) => {
        Logger.logException(loggingCategory, err, Logger.logError);
      });
  }

  public async lockTargetModel(): Promise<void> {
    if (this.targetModelId === undefined)
      throw new IModelError(IModelStatus.BadModel, "", Logger.logError, loggingCategory, () => this.targetModelId);

    // IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Locking model ..."));

    // return this.iModel.editing.concurrencyControl.lockModel(this.targetModelId);
  }

}
