/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, Id64, Id64Array, Id64String } from "@bentley/bentleyjs-core";
import { IModelJson, LineSegment3d, LineString3d, Point3d, Transform, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { Code, ColorDef, GeometryStreamProps, IModelWriteRpcInterface, LinePixels, PhysicalElementProps } from "@bentley/imodeljs-common";
import {
  AccuDrawHintBuilder, BeButtonEvent, DecorateContext, DynamicsContext, ElementEditor3d, EventHandled, GraphicType, HitDetail, IModelApp,
  InteractiveEditingSession, LocateFilterStatus, LocateResponse, PrimitiveTool, Tool,
} from "@bentley/imodeljs-frontend";
import { setTitle } from "./Title";

// Simple tools for testing interactive editing. They require the iModel to have been opened in read-write mode.

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
    if (!imodel)
      return;

    const session = InteractiveEditingSession.get(imodel);
    if (session)
      await session.end();
    else
      await InteractiveEditingSession.begin(imodel);

    setTitle(imodel);
  }
}

export abstract class UndoRedoTool extends Tool {
  protected abstract get isUndo(): boolean;

  public run(): boolean {
    const imodel = IModelApp.viewManager.selectedView?.iModel;
    if (imodel) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      IModelWriteRpcInterface.getClient().undoRedo(imodel.getRpcProps(), this.isUndo);
    }

    return true;
  }
}

export class UndoTool extends UndoRedoTool {
  public static toolId = "DtaUndo";
  protected get isUndo() { return true; }
}

export class RedoTool extends UndoRedoTool {
  public static toolId = "DtaRedo";
  protected get isUndo() { return false; }
}

/** Delete all elements currently in the selection set. */
export class DeleteElementsTool extends Tool {
  public static toolId = "DeleteElements";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 0; }

  public run(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this._run();
    return true;
  }

  private async _run(): Promise<void> {
    const imodel = IModelApp.viewManager.selectedView?.iModel;
    if (!imodel)
      return;

    const elements = imodel.selectionSet.elements;
    if (0 === elements.size)
      return;

    try {
      await IModelWriteRpcInterface.getClient().deleteElements(imodel.getRpcProps(), Array.from(elements));
      await imodel.saveChanges();
    } catch (err) {
      alert(err.toString());
    }
  }
}

/** A basic interactive editing tool. */
abstract class InteractiveEditingTool extends PrimitiveTool {
  private _editor?: ElementEditor3d;

  protected async getEditor(): Promise<ElementEditor3d> {
    if (!this._editor)
      this._editor = await ElementEditor3d.start(this.iModel);

    return this._editor;
  }

  public onCleanup(): void {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.closeEditor();
  }

  private async closeEditor(): Promise<void> {
    if (this._editor) {
      await this._editor.end();
      this._editor = undefined;
    }
  }
}

/** Moves elements to a different location. */
export class MoveElementTool extends InteractiveEditingTool {
  public static toolId = "MoveElements";
  private _useSelection = false;
  private _elementIds: Id64Array = [];
  private _startPoint?: Point3d;
  private _endPoint?: Point3d;

  private takeSelectionSet(): void {
    this._useSelection = (undefined !== this.targetView && this.iModel.selectionSet.isActive);
    if (!this._useSelection)
      return;

    this._elementIds.length = 0;
    for (const id of this.iModel.selectionSet.elements)
      if (Id64.isValidId64(id) && !Id64.isTransient(id))
        this._elementIds.push(id);
  }

  private setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    if (!this._useSelection)
      IModelApp.accuSnap.enableLocate(true);

    this.showPrompt();
  }

  private showPrompt(): void {
    let msg;
    if (undefined === this._startPoint)
      msg = this._useSelection ? "Start point for move" : "Identify element";
    else
      msg = undefined === this._endPoint ? "End point for move" : "Confirm move";

    IModelApp.notifications.outputPrompt(msg);
  }

  public requireWriteableTarget(): boolean {
    return true;
  }

  public onUnsuspend(): void {
    this.showPrompt();
  }

  public onPostInstall(): void {
    super.onPostInstall();
    this.takeSelectionSet();
    this.setupAndPromptForNextAction();
  }

  public async onStartPoint(pt: Point3d): Promise<void> {
    const editor = await this.getEditor();
    await editor.startModifyingElements(this._elementIds);
    this._startPoint = pt;
    this.beginDynamics();
    this.setupAndPromptForNextAction();
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this._startPoint) {
      if (!this._useSelection) {
        const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
        if (undefined === hit || !hit.isElementHit)
          return EventHandled.No;

        this._elementIds.push(hit.sourceId);
      }

      await this.onStartPoint(ev.point);
      return EventHandled.No;
    }

    assert(undefined === this._endPoint);
    this._endPoint = ev.point;
    this.endDynamics();

    const delta = this._endPoint.minus(this._startPoint);
    const transform = Transform.createTranslation(delta);

    const editor = await this.getEditor();
    await editor.applyTransform(transform.toJSON());
    await editor.write();
    await this.saveChanges();

    if (this.shouldRestart()) {
      const startPoint = this._endPoint;
      this._endPoint = undefined;
      this.onStartPoint(startPoint); // eslint-disable-line @typescript-eslint/no-floating-promises
    } else {
      this.onReinitialize();
    }

    return EventHandled.No;
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (undefined === this._startPoint)
      return;

    const builder = context.target.createGraphicBuilder(GraphicType.WorldOverlay, context.viewport);
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 3, LinePixels.HiddenLine);
    builder.addLineString([this._startPoint.clone(), ev.point.clone()]);
    context.addGraphic(builder.finish());
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize();
    return EventHandled.No;
  }

  private shouldRestart(): boolean {
    return !this._useSelection && 0 !== this._elementIds.length;
  }

  public onReinitialize(): void {
    if (!this.shouldRestart())
      this.exitTool();
    else
      this.onRestartTool();
  }

  public onRestartTool(): void {
    const tool = new MoveElementTool();
    if (!tool.run())
      tool.exitTool();
  }

  public async filterHit(hit: HitDetail, _out: LocateResponse): Promise<LocateFilterStatus> {
    return hit.isElementHit ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
  }
}

/** Places a line string. The first model in the view's model selector and the first category in its category selector are used. */
export class PlaceLineStringTool extends InteractiveEditingTool {
  public static toolId = "PlaceLineString";
  private readonly _points: Point3d[] = [];
  private _snapGeomId?: Id64String;

  public requireWriteableTarget(): boolean { return true; }

  public onPostInstall(): void {
    super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);

    const nPts = this._points.length;
    const prompts = ["Enter start point", "Enter second point", "Enter next point or Reset to finish"];
    const prompt = prompts[Math.min(nPts, 2)];
    IModelApp.notifications.outputPrompt(prompt);

    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.enableSmartRotation = true;

    if (nPts > 1 && !this._points[nPts - 1].isAlmostEqual(this._points[nPts - 2]))
      hints.setXAxis(Vector3d.createStartEnd(this._points[nPts - 2], this._points[nPts - 1])); // Rotate AccuDraw to last segment.

    hints.setOrigin(this._points[nPts - 1]);
    hints.sendHints();
  }

  public testDecorationHit(id: Id64String): boolean {
    return id === this._snapGeomId;
  }

  public getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined {
    if (this._points.length < 2)
      return undefined;

    const geom = IModelJson.Writer.toIModelJson(LineString3d.create(this._points));
    return geom ? [ geom ] : undefined;
  }

  public decorate(context: DecorateContext): void {
    if (this._points.length < 2)
      return;

    if (undefined === this._snapGeomId)
      this._snapGeomId = this.iModel.transientIds.next;

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined, this._snapGeomId);
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString([...this._points]);
    context.addDecorationFromBuilder(builder);
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this._points.length < 1)
      return;

    // Only draw current segment in dynamics - accepted segments are drawn as pickable decorations.
    const builder = context.createSceneGraphicBuilder();
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString([this._points[this._points.length - 1].clone(), ev.point.clone()]);
    context.addGraphic(builder.finish());
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    await this.getEditor();
    this._points.push(ev.point.clone());
    this.setupAndPromptForNextAction();

    if (!this.isDynamicsStarted)
      this.beginDynamics();

    return EventHandled.No;
  }

  private async createElement(): Promise<void> {
    const vp = this.targetView;
    assert(undefined !== vp);
    assert(2 <= this._points.length);

    let category;
    for (const catId of vp.view.categorySelector.categories) {
      category = catId;
      break;
    }

    if (undefined === category)
      return;

    let model;
    if (vp.view.is2d()) {
      model = vp.view.baseModelId;
    } else if (vp.view.isSpatialView()) {
      for (const modId of vp.view.modelSelector.models) {
        model = modId;
        break;
      }
    }

    if (undefined === model)
      return;

    const origin = this._points[0];
    const angles = new YawPitchRollAngles();
    const pts = this._points.map((p) => p.minus(origin));

    const primitive = this._points.length === 2 ? LineSegment3d.create(pts[0], pts[1]) : LineString3d.create(pts);
    const geom = IModelJson.Writer.toIModelJson(primitive);
    const props: PhysicalElementProps = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty() };

    const editor = await this.getEditor();
    return editor.createElement(props, origin, angles, geom);
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    if (this._points.length >= 2) {
      IModelApp.notifications.outputPrompt("");

      await this.createElement();
      const editor = await this.getEditor();
      await editor.write();
      await this.saveChanges();
    }

    this.onReinitialize();
    return EventHandled.No;
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this._points.length)
      return false;

    this._points.pop();
    if (0 === this._points.length)
      this.onReinitialize();
    else
      this.setupAndPromptForNextAction();

    return true;
  }

  public onRestartTool(): void {
    const tool = new PlaceLineStringTool();
    if (!tool.run())
      this.exitTool();
  }
}
