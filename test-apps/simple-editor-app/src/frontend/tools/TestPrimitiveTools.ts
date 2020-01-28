/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import {
  Logger, Id64String, Id64Array, Id64, assert,
} from "@bentley/bentleyjs-core";
import {
  IModelJson as GeomJson,
  LineString3d,
  Point3d,
  Vector3d,
  LineSegment3d,
  IModelJson,
  YawPitchRollAngles,
  TransformProps,
  Transform,
} from "@bentley/geometry-core";
import {
  AccuDrawHintBuilder,
  AccuDrawShortcuts,
  BeButtonEvent,
  DecorateContext,
  DynamicsContext,
  EventHandled,
  GraphicType,
  HitDetail,
  IModelApp,
  PrimitiveTool,
  SnapStatus,
  ElementEditor3d,
  Viewport,
  NotifyMessageDetails,
  OutputMessagePriority,
  CoreTools,
  LocateResponse,
  LocateFilterStatus,
  OutputMessageType,
  OutputMessageAlert,
} from "@bentley/imodeljs-frontend";
import {
  ColorDef,
  GeometryStreamProps,
  IModelError,
  IModelStatus,
  Code,
  GeometricElement3dProps,
} from "@bentley/imodeljs-common";

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

    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Locking model ..."));

    return this.iModel.editing.concurrencyControl.lockModel(this.targetModelId)
      .then(() => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "")));
  }

}

export class PlaceLinestringTool extends PrimitiveToolEx {
  public static toolId = "PlaceLinestringTool.Points";
  public readonly points: Point3d[] = [];
  protected _snapGeomId?: string;

  public requireWriteableTarget(): boolean { return true; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);

    const prompt = (0 === this.points.length) ? "Start point" : (this.points.length < 2) ? "Next point" : "Additional point or Reset to finish";
    IModelApp.notifications.outputPrompt(prompt);

    if (0 === this.points.length)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.enableSmartRotation = true;

    if (this.points.length > 1 && !(this.points[this.points.length - 1].isAlmostEqual(this.points[this.points.length - 2])))
      hints.setXAxis(Vector3d.createStartEnd(this.points[this.points.length - 2], this.points[this.points.length - 1])); // Rotate AccuDraw to last segment...

    hints.setOrigin(this.points[this.points.length - 1]);
    hints.sendHints();
  }

  public testDecorationHit(id: string): boolean { return id === this._snapGeomId; }

  public getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined {
    if (this.points.length < 2)
      return undefined;

    const geomData = GeomJson.Writer.toIModelJson(LineString3d.create(this.points));
    return (undefined === geomData ? undefined : [geomData]);
  }

  public decorate(context: DecorateContext): void {
    if (this.points.length < 2)
      return;

    if (undefined === this._snapGeomId)
      this._snapGeomId = this.iModel.transientIds.next;

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined, this._snapGeomId);

    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString(this.points);

    context.addDecorationFromBuilder(builder);
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this.points.length < 1)
      return;

    const builder = context.createSceneGraphicBuilder();

    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString([this.points[this.points.length - 1], ev.point]); // Only draw current segment in dynamics, accepted segments are drawn as pickable decorations...

    context.addGraphic(builder.finish());
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    await this.ensureEditorConnection();

    this.points.push(ev.point.clone());
    this.setupAndPromptForNextAction();

    if (!this.isDynamicsStarted) {
      await this.lockTargetModel();
      this.beginDynamics();
    }

    return EventHandled.No;
  }

  private async createElement(): Promise<void> {
    let primitive;
    if (this.points.length === 2) {
      primitive = LineSegment3d.create(this.points[0], this.points[1]);
    } else {
      primitive = LineString3d.create(this.points);
    }
    const geomprops = IModelJson.Writer.toIModelJson(primitive);

    const origin = this.points[0];
    const angles = new YawPitchRollAngles();

    const model = this.targetModelId!;
    const category = this.targetCategory;

    const props3d: GeometricElement3dProps = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty() };

    return this.editorConnection.createElement(props3d, origin, angles, geomprops);
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined !== IModelApp.accuSnap.currHit) {
      const status = await IModelApp.accuSnap.resetButton(); // TESTING ONLY - NOT NORMAL TOOL OPERATION - Exercise AccuSnap hit cycling...only restart when no current hit or not hot snap on next hit...
      if (SnapStatus.Success === status)
        return EventHandled.No;
    }

    if (this.points.length >= 2) {
      const msg = new NotifyMessageDetails(OutputMessagePriority.Info, "Creating element...");
      IModelApp.notifications.outputPrompt("");
      IModelApp.notifications.outputMessage(msg);

      await this.createElement();
      await this.editorConnection.write();
      await this.saveChanges();

      msg.briefMessage = "Created element.";
      IModelApp.notifications.outputMessage(msg);
    }

    this.onReinitialize();
    return EventHandled.No;
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this.points.length)
      return false;

    this.points.pop();
    if (0 === this.points.length)
      this.onReinitialize();
    else
      this.setupAndPromptForNextAction();
    return true;
  }

  public async onKeyTransition(wentDown: boolean, keyEvent: KeyboardEvent): Promise<EventHandled> {
    if (EventHandled.Yes === await super.onKeyTransition(wentDown, keyEvent))
      return EventHandled.Yes;
    return (wentDown && AccuDrawShortcuts.processShortcutKey(keyEvent)) ? EventHandled.Yes : EventHandled.No;
  }

  public onRestartTool(): void {
    const tool = new PlaceLinestringTool();
    if (!tool.run())
      this.exitTool();
  }
}

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
      await this.iModel.editing.deleteElements(ids);
      await this.saveChanges();

      const msg = new NotifyMessageDetails(OutputMessagePriority.Info, `${ids.length} elements deleted`, "", OutputMessageType.Toast, OutputMessageAlert.None);
      IModelApp.notifications.outputMessage(msg);
    } catch (err) {
      const msg = new NotifyMessageDetails(OutputMessagePriority.Error, "Delete failed - " + err.toString(), err.toString());
      IModelApp.notifications.outputMessage(msg);
    }
  }

}

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
      this.onStartPoint(wasEndPoint); // tslint:disable-line:no-floating-promises
    } else {
      this.onReinitialize();
    }

    return EventHandled.No;
  }

  private async doMove(endPointView?: Point3d) {
    const endPoint = endPointView || this._endPoint!;
    const xlat = endPoint.minus(this._startPoint!);
    const tprops: TransformProps = Transform.createTranslationXYZ(xlat.x, xlat.y, xlat.z);
    return this.editorConnection.applyTransform(tprops);
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
