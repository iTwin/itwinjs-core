/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, Id64String } from "@bentley/bentleyjs-core";
import {
  IModelJson, LineSegment3d, LineString3d, Point3d, Vector3d, YawPitchRollAngles,
} from "@bentley/geometry-core";
import {
  Code, ColorDef, GeometryStreamProps, PhysicalElementProps,
} from "@bentley/imodeljs-common";
import {
  AccuDrawHintBuilder, BeButtonEvent, DecorateContext, DynamicsContext, ElementEditor3d,
  EventHandled, GraphicType, HitDetail, IModelApp, PrimitiveTool, Tool,
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
    if (!imodel || !imodel.isBriefcaseConnection())
      return;

    const session = imodel.editingSession;
    if (session)
      await session.end();
    else
      await imodel.beginEditingSession();

    setTitle(imodel);
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
    return geom ? [geom] : undefined;
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
