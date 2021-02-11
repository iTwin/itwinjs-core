/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64, Id64Array } from "@bentley/bentleyjs-core";
import {
  BeButtonEvent, CoreTools, EventHandled, HitDetail, IModelApp, LocateFilterStatus, LocateResponse, NotifyMessageDetails, OutputMessageAlert,
  OutputMessagePriority, OutputMessageType,
} from "@bentley/imodeljs-frontend";
import { PrimitiveToolEx } from "./PrimitiveToolEx";

export class DeleteElementTool extends PrimitiveToolEx {
  public static toolId = "DeleteElement";
  private _useSelection = false;
  private _elementIds?: Id64Array;

  private setupAndPromptForNextAction(): void {
    this._useSelection = (undefined !== this.targetView && this.targetView.iModel.selectionSet.isActive);
    if (!this._useSelection)
      IModelApp.accuSnap.enableLocate(true);

    this.showPrompt();
  }

  private showPrompt(): void {
    CoreTools.outputPromptByKey(this._useSelection ? "ElementSet.Prompts.ConfirmSelection" : "ElementSet.Prompts.IdentifyElement");
  }

  public autoLockTarget(): void { }

  public requireWriteableTarget(): boolean { return true; }

  public onUnsuspend(): void {
    this.showPrompt();
  }

  public onPostInstall(): void {
    super.onPostInstall();

    if (undefined !== this._elementIds)
      this.process(this._elementIds).then(() => {
        this.onReinitialize();
      }).catch((err: Error) => {
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, err.toString()));
      });
    else {
      this.setupAndPromptForNextAction();
    }
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (this._useSelection) {
      if (undefined !== ev.viewport) {
        const ids: Id64Array = [];
        ev.viewport.iModel.selectionSet.elements.forEach((id) => {
          if (!Id64.isInvalid(id) && !Id64.isTransient(id))
            ids.push(id);
        });

        if (0 === ids.length)
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, CoreTools.translate("ElementSet.Error.NotSupportedElmType")));
        else
          await this.process(ids);

        this.onReinitialize();
        return EventHandled.Yes;
      }
    }

    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (undefined === hit || !hit.isElementHit)
      return EventHandled.No;

    await this.process([hit.sourceId]);
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize();
    return EventHandled.No;
  }

  public onReinitialize(): void {
    if (this._useSelection || undefined !== this._elementIds) {
      this.exitTool();
    } else {
      this.onRestartTool();
    }
  }

  public onRestartTool(): void {
    const tool = new DeleteElementTool();
    if (!tool.run())
      this.exitTool();
  }

  public async filterHit(hit: HitDetail, _out: LocateResponse): Promise<LocateFilterStatus> {
    return hit.isElementHit ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
  }

  private async process(ids: string[]) {
    try {
      // NEEDS WORK
      // await this.iModel.editing.deleteElements(ids);
      // await this.saveChanges();

      const msg = new NotifyMessageDetails(OutputMessagePriority.Info, `${ids.length} elements deleted`, "", OutputMessageType.Toast, OutputMessageAlert.None);
      IModelApp.notifications.outputMessage(msg);
    } catch (err) {
      const msg = new NotifyMessageDetails(OutputMessagePriority.Error, `Delete failed - ${err.toString()}`, err.toString());
      IModelApp.notifications.outputMessage(msg);
    }
  }

}
