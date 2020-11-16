/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, Id64, Id64Array } from "@bentley/bentleyjs-core";
import { Point3d, Transform } from "@bentley/geometry-core";
import { ColorDef } from "@bentley/imodeljs-common";
import {
  BeButtonEvent, CoreTools, DynamicsContext, EventHandled, HitDetail, IModelApp, LocateFilterStatus, LocateResponse, NotifyMessageDetails,
  OutputMessagePriority,
} from "@bentley/imodeljs-frontend";
import { PrimitiveToolEx } from "./PrimitiveToolEx";

// cSpell:ignore xlat tprops

export class MoveElementTool extends PrimitiveToolEx {
  public static toolId = "MoveElement";
  private _useSelection = false;
  private _elementIds: Id64Array = [];
  private _startPoint?: Point3d;
  private _endPoint?: Point3d;

  private takeSelectionSet() {
    this._useSelection = (undefined !== this.targetView && this.targetView.iModel.selectionSet.isActive);
    if (!this._useSelection || !this.targetView)
      return;
    this._elementIds = [];
    this.targetView.iModel.selectionSet.elements.forEach((id) => {
      if (!Id64.isInvalid(id) && !Id64.isTransient(id))
        this._elementIds.push(id);
    });
    if (0 === this._elementIds.length)
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, CoreTools.translate("ElementSet.Error.NotSupportedElmType")));
    return EventHandled.Yes;
  }

  private setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    if (!this._useSelection)
      IModelApp.accuSnap.enableLocate(true);
    this.showPrompt();
  }

  private showPrompt(): void {
    if (this._startPoint === undefined) {
      if (!this._useSelection)
        CoreTools.outputPromptByKey("ElementSet.Prompts.IdentifyElement");
      else
        IModelApp.notifications.outputPrompt("Start point for move");
    } else if (this._endPoint === undefined) {
      IModelApp.notifications.outputPrompt("End point for move");
    } else {
      IModelApp.notifications.outputPrompt("Confirm");
    }
  }

  public autoLockTarget(): void { }

  public requireWriteableTarget(): boolean { return true; }

  public onUnsuspend(): void {
    this.showPrompt();
  }

  public onPostInstall(): void {
    super.onPostInstall();
    this.takeSelectionSet();
    this.setupAndPromptForNextAction();
  }

  public async onStartPoint(pt: Point3d) {
    await this.ensureEditorConnection();
    await this.lockTargetModel();
    await this.editorConnection.startModifyingElements(this._elementIds);
    this._startPoint = pt;
    this.beginDynamics();
    this.setupAndPromptForNextAction();
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (this._startPoint === undefined) {
      if (!this._useSelection) {
        const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
        if (undefined === hit || !hit.isElementHit)
          return EventHandled.No;
        this._elementIds.push(hit.sourceId);
      }
      await this.onStartPoint(ev.point);
      return EventHandled.No;
    }
    assert(this._endPoint === undefined);
    this._endPoint = ev.point;
    this.endDynamics();
    await this.doMove();
    await this.editorConnection.write();
    await this.saveChanges();
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Moved"));
    // Allow repeated movements of same elements.
    if (this.shouldRestart()) {
      const wasEndPoint = this._endPoint;
      this._endPoint = undefined;
      this.onStartPoint(wasEndPoint); // eslint-disable-line @typescript-eslint/no-floating-promises
    } else {
      this.onReinitialize();
    }
    return EventHandled.No;
  }

  private async doMove(endPointView?: Point3d) {
    const endPoint = endPointView || this._endPoint!;
    const xlat = endPoint.minus(this._startPoint!);
    const tprops = Transform.createTranslationXYZ(xlat.x, xlat.y, xlat.z);
    return this.editorConnection.applyTransform(tprops.toJSON());
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this._startPoint === undefined)
      return;
    const builder = context.createSceneGraphicBuilder();
    // TODO: this.doMove(ev.point)
    // TODO: get geometry from backend and display it.
    // TODO: For now, just draw a line
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString([this._startPoint, ev.point]);
    context.addGraphic(builder.finish());
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize();
    return EventHandled.No;
  }

  private shouldRestart(): boolean {
    return !this._useSelection && (this._elementIds.length !== 0);
  }

  public onReinitialize(): void {
    if (!this.shouldRestart()) {
      this.exitTool();
    } else {
      this.onRestartTool();
    }
  }

  public onRestartTool(): void {
    const tool = new MoveElementTool();
    if (!tool.run())
      this.exitTool();
  }

  public async filterHit(hit: HitDetail, _out: LocateResponse): Promise<LocateFilterStatus> {
    return hit.isElementHit ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
  }
}
