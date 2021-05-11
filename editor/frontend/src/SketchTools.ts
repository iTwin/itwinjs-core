/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";
import {
  IModelJson, LineString3d, Point3d, Vector3d, YawPitchRollAngles,
} from "@bentley/geometry-core";
import {
  Code, ColorDef, ElementGeometry, FlatBufferGeometryStream, GeometricElementProps, GeometryStreamProps, isPlacement3dProps, JsonGeometryStream, PlacementProps,
} from "@bentley/imodeljs-common";
import {
  AccuDrawHintBuilder, BeButtonEvent, CoreTools, DecorateContext, DynamicsContext,
  EventHandled, GraphicType, HitDetail, IModelApp, NotifyMessageDetails, OutputMessagePriority, ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction, ToolAssistanceSection,
} from "@bentley/imodeljs-frontend";
import { BasicManipulationCommandIpc, editorBuiltInCmdIds } from "@bentley/imodeljs-editor-common";
import { CreateElementTool, DynamicGraphicsProvider } from "./CreateElementTool";
import { EditTools } from "./EditTool";

/** @alpha Places a line string. Uses model and category from ToolAdmin.ActiveSettings. */
export class CreateLineStringTool extends CreateElementTool {
  public static toolId = "CreateLineString";
  protected readonly _points: Point3d[] = [];
  protected _snapGeomId?: Id64String;
  protected _graphicsProvider?: DynamicGraphicsProvider;
  protected _startedCmd?: string;

  protected get wantAccuSnap(): boolean { return true; }
  protected get wantDynamics(): boolean { return true; }

  protected async startCommand(): Promise<string> {
    if (undefined !== this._startedCmd)
      return this._startedCmd;
    return EditTools.startCommand<string>(editorBuiltInCmdIds.cmdBasicManipulation, this.iModel.key);
  }

  public static callCommand<T extends keyof BasicManipulationCommandIpc>(method: T, ...args: Parameters<BasicManipulationCommandIpc[T]>): ReturnType<BasicManipulationCommandIpc[T]> {
    return EditTools.callCommand(method, ...args) as ReturnType<BasicManipulationCommandIpc[T]>;
  }

  protected setupAndPromptForNextAction(): void {
    const nPts = this._points.length;

    if (0 !== nPts) {
      const hints = new AccuDrawHintBuilder();

      if (nPts > 1 && !this._points[nPts - 1].isAlmostEqual(this._points[nPts - 2]))
        hints.setXAxis(Vector3d.createStartEnd(this._points[nPts - 2], this._points[nPts - 1])); // Rotate AccuDraw to last segment.

      hints.setOrigin(this._points[nPts - 1]);
      hints.sendHints();
    }

    super.setupAndPromptForNextAction();
  }

  protected provideToolAssistance(_mainInstrText?: string, _additionalInstr?: ToolAssistanceInstruction[]): void {
    const nPts = this._points.length;
    const mainMsg = 0 === nPts ? "ElementSet.Prompts.StartPoint" : (1 === nPts ? "ElementSet.Prompts.EndPoint" : "ElementSet.Inputs.AdditionalPoint");
    const leftMsg = "ElementSet.Inputs.AcceptPoint";
    const rghtMsg = nPts > 1 ? "ElementSet.Inputs.Complete" : "ElementSet.Inputs.Cancel";

    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, CoreTools.translate(leftMsg), false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, CoreTools.translate(leftMsg), false, ToolAssistanceInputMethod.Mouse));

    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, CoreTools.translate(rghtMsg), false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, CoreTools.translate(rghtMsg), false, ToolAssistanceInputMethod.Mouse));

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, CoreTools.translate(mainMsg));
    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  public testDecorationHit(id: Id64String): boolean {
    return id === this._snapGeomId;
  }

  public async getToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    if (this.testDecorationHit(hit.sourceId))
      return this.description;
    return super.getToolTip(hit);
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

    const builder = context.createGraphic({ type: GraphicType.WorldDecoration, pickable: { id: this._snapGeomId, locateOnly: true }});
    builder.setSymbology(ColorDef.white, ColorDef.white, 1);
    builder.addLineString(this._points); // Allow snapping to accepted segments...
    context.addDecorationFromBuilder(builder);
  }

  protected clearGraphics(): void {
    if (undefined === this._graphicsProvider)
      return;
    this._graphicsProvider.cleanupGraphic();
    this._graphicsProvider = undefined;
  }

  protected async createGraphics(ev: BeButtonEvent): Promise<void> {
    const placement = this.getPlacementProps(ev);
    if (undefined === placement)
      return;

    const geometry = this.getGeometryProps(placement, ev);
    if (undefined === geometry)
      return;

    if (undefined === this._graphicsProvider)
      this._graphicsProvider = new DynamicGraphicsProvider(this.iModel, this.toolId);

    await this._graphicsProvider.createGraphic(this.targetCategory, placement, geometry);
  }

  public onDynamicFrame(_ev: BeButtonEvent, context: DynamicsContext): void {
    if (undefined !== this._graphicsProvider)
      this._graphicsProvider.addGraphic(context);
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    return this.createGraphics(ev);
  }

  protected getPlacementProps(ev?: BeButtonEvent): PlacementProps | undefined {
    const vp = this.targetView;
    if (undefined === vp || 0 === this._points.length)
      return undefined;

    const origin = this._points[0];
    const angles = new YawPitchRollAngles();

    const matrix = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);
    const pts = (undefined === ev ? this._points : [...this._points, ev.point]);
    ElementGeometry.Builder.placementAnglesFromPoints(pts, matrix?.getColumn(2), angles);

    if (vp.view.is3d())
      return { origin, angles };

    return { origin, angle: angles.yaw };
  }

  protected getGeometryProps(placement: PlacementProps, ev?: BeButtonEvent): JsonGeometryStream | FlatBufferGeometryStream | undefined {
    const numRequired = (undefined === ev ? 2 : 1);
    if (this._points.length < numRequired)
      return;

    const builder = new ElementGeometry.Builder();
    const pts = (undefined === ev ? this._points : [...this._points, ev.point]);
    const primitive = LineString3d.create(pts);

    builder.setLocalToWorldFromPlacement(placement);

    if (!builder.appendGeometryQuery(primitive))
      return;

    return { format: "flatbuffer", data: builder.entries };
  }

  protected getElementProps(placement: PlacementProps): GeometricElementProps | undefined {
    const model = this.targetModelId;
    const category = this.targetCategory;

    if (isPlacement3dProps(placement))
      return { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty(), placement };

    return { classFullName: "BisCore:DrawingGraphic", model, category, code: Code.createEmpty(), placement };
  }

  protected async createElement(): Promise<void> {
    const placement = this.getPlacementProps();
    if (undefined === placement)
      return;

    const geometry = this.getGeometryProps(placement);
    if (undefined === geometry)
      return;

    const elemProps = this.getElementProps(placement);
    if (undefined === elemProps)
      return;

    let data;
    if ("flatbuffer" === geometry.format)
      data = { entryArray: geometry.data };
    else
      elemProps.geom = geometry.data;

    try {
      this._startedCmd = await this.startCommand();
      await CreateLineStringTool.callCommand("insertGeometricElement", elemProps, data);
      await this.saveChanges();
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, err.toString()));
    }
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this._points.push(ev.point.clone());
    return super.onDataButtonDown(ev);
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    // Accept on reset if we have at least 2 points, starting another tool will reject accepted segments...
    if (this._points.length >= 2)
      await this.createElement();

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
    const tool = new CreateLineStringTool();
    if (!tool.run())
      this.exitTool();
  }

  public onCleanup(): void {
    this.clearGraphics();
    super.onCleanup();
  }
}
