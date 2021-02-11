/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelJson as GeomJson, LineSegment3d, LineString3d, Point3d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { Code, ColorDef, GeometryStreamProps, PhysicalElementProps } from "@bentley/imodeljs-common";
import {
  AccuDrawHintBuilder, BeButtonEvent, DecorateContext, DynamicsContext, EventHandled, GraphicType, HitDetail, IModelApp, NotifyMessageDetails,
  OutputMessagePriority, SnapStatus,
} from "@bentley/imodeljs-frontend";
import { PrimitiveToolEx } from "./PrimitiveToolEx";

export class PlaceLineStringTool extends PrimitiveToolEx {
  public static toolId = "PlaceLinestring";
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
    const origin = this.points[0];
    const angles = new YawPitchRollAngles();
    const pts = this.points.map((pt3) => pt3.minus(origin));

    let primitive;
    if (this.points.length === 2) {
      primitive = LineSegment3d.create(pts[0], pts[1]);
    } else {
      primitive = LineString3d.create(pts);
    }
    const geomProps = GeomJson.Writer.toIModelJson(primitive);

    const model = this.targetModelId;
    const category = this.targetCategory;

    const props3d: PhysicalElementProps = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty() };

    return this.editorConnection.createElement(props3d, origin, angles, geomProps);
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

  public onRestartTool(): void {
    const tool = new PlaceLineStringTool();
    if (!tool.run())
      this.exitTool();
  }
}
