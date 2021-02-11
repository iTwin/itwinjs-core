/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String, Logger } from "@bentley/bentleyjs-core";
import { IModelJson as GeomJson, LineSegment3d, LineString3d, Point3d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { Code, ColorDef, GeometricElement3dProps, GeometryStreamProps, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import {
  AccuDrawHintBuilder, BeButtonEvent, DecorateContext, DynamicsContext, ElementEditor3d, EventHandled, GraphicType, HitDetail, IModelApp,
  PrimitiveTool, RemoteBriefcaseConnection, SnapStatus, Viewport,
} from "@bentley/imodeljs-frontend";

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

  public isCompatibleViewport(_vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean {
    return true;
  }

  public run(): boolean {
    super.run();
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
    if (this.targetModelId === undefined || !(this.iModel instanceof RemoteBriefcaseConnection)) // eslint-disable-line deprecation/deprecation
      throw new IModelError(IModelStatus.BadModel, "", Logger.logError, loggingCategory, () => this.targetModelId);

    return this.iModel.editing.concurrencyControl.lockModel(this.targetModelId);
  }

}

export class PlacementTestTool extends PrimitiveToolEx {
  public static toolId = "PlacementTestTool.Points";
  public readonly points: Point3d[] = [];
  protected _snapGeomId?: string;

  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);

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
    const geomprops = GeomJson.Writer.toIModelJson(primitive);

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
      await this.createElement();
      await this.editorConnection.write();
      await this.saveChanges();
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
    const tool = new PlacementTestTool();
    if (!tool.run())
      this.exitTool();
  }
}
