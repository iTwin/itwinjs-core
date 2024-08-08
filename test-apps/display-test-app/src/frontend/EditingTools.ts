/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, CompressedId64Set, Id64String, OrderedId64Array } from "@itwin/core-bentley";
import {
  Code, ColorDef, ElementGeometry, GeometryPartProps, GeometryStreamBuilder, GeometryStreamProps, IModel, PhysicalElementProps,
} from "@itwin/core-common";
import {
  AccuDrawHintBuilder, BeButtonEvent, BriefcaseConnection, CoreTools, DecorateContext, DynamicsContext, EventHandled, GraphicType, HitDetail, IModelApp,
  NotifyMessageDetails, OutputMessagePriority, Tool, ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction,
  ToolAssistanceSection,
} from "@itwin/core-frontend";
import { IModelJson, LineString3d, Point3d, Sphere, Transform, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { editorBuiltInCmdIds } from "@itwin/editor-common";
import { basicManipulationIpc, CreateElementTool, EditTools } from "@itwin/editor-frontend";
import { setTitle } from "./Title";

// Simple tools for testing interactive editing. They require the iModel to have been opened in read-write mode.

/** If an editing scope is currently in progress, end it; otherwise, begin a new one. */
export class EditingScopeTool extends Tool {
  public static override toolId = "EditingSession";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }

  public override async run(): Promise<boolean> {
    await this._run();
    return true;
  }

  private async _run(): Promise<void> {
    const imodel = IModelApp.viewManager.selectedView?.iModel;
    if (!imodel || !imodel.isBriefcaseConnection())
      return;

    const scope = imodel.editingScope;
    if (scope)
      await scope.exit();
    else
      await imodel.enterEditingScope();

    setTitle(imodel);
  }
}

/** Places a line string. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class PlaceLineStringTool extends CreateElementTool {
  public static override toolId = "PlaceLineString";
  private readonly _points: Point3d[] = [];
  private _snapGeomId?: Id64String;
  private _testGeomJson = false;
  private _testGeomParts = false;
  protected _startedCmd?: string;

  protected override get wantAccuSnap(): boolean { return true; }
  protected override get wantDynamics(): boolean { return true; }

  protected async startCommand(): Promise<string> {
    if (undefined !== this._startedCmd)
      return this._startedCmd;
    return EditTools.startCommand<string>({ commandId: editorBuiltInCmdIds.cmdBasicManipulation, iModelKey: this.iModel.key });
  }

  protected override setupAndPromptForNextAction(): void {
    const nPts = this._points.length;

    if (0 !== nPts) {
      const hints = new AccuDrawHintBuilder();
      hints.enableSmartRotation = true;

      if (nPts > 1 && !this._points[nPts - 1].isAlmostEqual(this._points[nPts - 2]))
        hints.setXAxis(Vector3d.createStartEnd(this._points[nPts - 2], this._points[nPts - 1])); // Rotate AccuDraw to last segment.

      hints.setOrigin(this._points[nPts - 1]);
      hints.sendHints();
    }

    super.setupAndPromptForNextAction();
  }

  protected override provideToolAssistance(_mainInstrText?: string, _additionalInstr?: ToolAssistanceInstruction[]): void {
    const nPts = this._points.length;
    const mainMsg = 0 === nPts ? "ElementSet.Prompts.StartPoint" : (1 === nPts ? "ElementSet.Prompts.EndPoint" : "ElementSet.Inputs.AdditionalPoint");
    const leftMsg = "ElementSet.Inputs.AcceptPoint";
    const rightMsg = nPts > 1 ? "ElementSet.Inputs.Complete" : "ElementSet.Inputs.Cancel";

    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, CoreTools.translate(leftMsg), false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, CoreTools.translate(leftMsg), false, ToolAssistanceInputMethod.Mouse));

    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, CoreTools.translate(rightMsg), false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, CoreTools.translate(rightMsg), false, ToolAssistanceInputMethod.Mouse));

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, CoreTools.translate(mainMsg));
    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  public override testDecorationHit(id: Id64String): boolean {
    return id === this._snapGeomId;
  }

  public override getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined {
    if (this._points.length < 2)
      return undefined;

    const geom = IModelJson.Writer.toIModelJson(LineString3d.create(this._points));
    return geom ? [geom] : undefined;
  }

  public override decorate(context: DecorateContext): void {
    if (this._points.length < 2)
      return;

    if (undefined === this._snapGeomId)
      this._snapGeomId = this.iModel.transientIds.getNext();

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined, this._snapGeomId);
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString(this._points);
    context.addDecorationFromBuilder(builder);
  }

  public override onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this._points.length < 1)
      return;

    // Only draw current segment in dynamics - accepted segments are drawn as pickable decorations.
    const builder = context.createSceneGraphicBuilder();
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString([this._points[this._points.length - 1].clone(), ev.point.clone()]);
    context.addGraphic(builder.finish());
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this._points.push(ev.point.clone());
    return super.onDataButtonDown(ev);
  }

  protected async createElement(): Promise<void> {
    const vp = this.targetView;
    assert(undefined !== vp);
    assert(2 <= this._points.length);

    const model = this.targetModelId;
    const category = this.targetCategory;

    const origin = this._points[0];
    const angles = new YawPitchRollAngles();

    const matrix = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);
    ElementGeometry.Builder.placementAnglesFromPoints(this._points, matrix?.getColumn(2), angles);

    try {
      this._startedCmd = await this.startCommand();

      if (this._testGeomJson) {
        const builder = new GeometryStreamBuilder();
        const primitive = LineString3d.create(this._points);

        builder.setLocalToWorld3d(origin, angles); // Establish world to local transform...
        if (!builder.appendGeometry(primitive))
          return;

        if (this._testGeomParts) {
          const partBuilder = new GeometryStreamBuilder();
          const sphere = Sphere.createCenterRadius(Point3d.createZero(), this._points[0].distance(this._points[1]) * 0.05);

          if (!partBuilder.appendGeometry(sphere))
            return;

          const partProps: GeometryPartProps = { classFullName: "BisCore:GeometryPart", model: IModel.dictionaryId, code: Code.createEmpty(), geom: partBuilder.geometryStream };
          const partId = await basicManipulationIpc.insertGeometryPart(partProps);

          for (const pt of this._points) {
            if (!builder.appendGeometryPart3d(partId, pt))
              return;
          }
        }

        const elemProps: PhysicalElementProps = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty(), placement: { origin, angles }, geom: builder.geometryStream };
        await basicManipulationIpc.insertGeometricElement(elemProps);
        await this.saveChanges();
      } else {
        const builder = new ElementGeometry.Builder();
        const primitive = LineString3d.create(this._points);

        builder.setLocalToWorld3d(origin, angles); // Establish world to local transform...
        if (!builder.appendGeometryQuery(primitive))
          return;

        if (this._testGeomParts) {
          const partBuilder = new ElementGeometry.Builder();
          const sphere = Sphere.createCenterRadius(Point3d.createZero(), this._points[0].distance(this._points[1]) * 0.05);

          if (!partBuilder.appendGeometryQuery(sphere))
            return;

          const partProps: GeometryPartProps = { classFullName: "BisCore:GeometryPart", model: IModel.dictionaryId, code: Code.createEmpty() };
          partProps.elementGeometryBuilderParams = { entryArray: partBuilder.entries };
          const partId = await basicManipulationIpc.insertGeometryPart(partProps);

          for (const pt of this._points) {
            if (!builder.appendGeometryPart3d(partId, pt))
              return;
          }
        }

        const elemProps: PhysicalElementProps = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty(), placement: { origin, angles } };
        elemProps.elementGeometryBuilderParams = { entryArray: builder.entries };
        await basicManipulationIpc.insertGeometricElement(elemProps);
        await this.saveChanges();
      }
    } catch (err: any) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, err.toString()));
    }
  }

  public override async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    // Accept on reset if we have at least 2 points, starting another tool will reject accepted segments...
    if (this._points.length >= 2)
      await this.createElement();

    await this.onReinitialize();
    return EventHandled.No;
  }

  public override async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this._points.length)
      return false;

    this._points.pop();
    if (0 === this._points.length)
      await this.onReinitialize();
    else
      this.setupAndPromptForNextAction();

    return true;
  }

  public async onRestartTool() {
    const tool = new PlaceLineStringTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

function compressIds(elementIds: string[]): CompressedId64Set {
  return CompressedId64Set.sortAndCompressIds(elementIds);
}

async function startCommand(imodel: BriefcaseConnection): Promise<string> {
  return EditTools.startCommand<string>({ commandId: editorBuiltInCmdIds.cmdBasicManipulation, iModelKey: imodel.key });
}

export async function transformElements(imodel: BriefcaseConnection, ids: string[], transform: Transform) {
  await startCommand(imodel);
  await basicManipulationIpc.transformPlacement(compressIds(ids), transform.toJSON());
}

/** This tool moves an element relative to its current position. */
export class MoveElementTool extends Tool {
  public static override toolId = "MoveElement";
  public static override get minArgs() { return 2; }
  public static override get maxArgs() { return 4; }

  public override async run(elementId: string, x: number, y: number, z: number): Promise<boolean> {

    if (!IModelApp.viewManager.selectedView) {
      return false;
    }
    const imodel = IModelApp.viewManager.selectedView.iModel;

    if (imodel.isBriefcaseConnection()) {
      await transformElements(imodel, [elementId], Transform.createTranslationXYZ(x, y, z));
      await imodel.saveChanges();
    }

    return true;
  }

  /** Executes this tool's run method passing in the elementId and the offset.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    let x = 0;
    let y = 0;
    let z = 0;

    if (args.length > 1)
      x = parseFloat(args[1]);
    if (args.length > 2)
      y = parseFloat(args[2]);
    if (args.length > 3)
      z = parseFloat(args[3]);

    return this.run(args[0], x, y, z);
  }
}
