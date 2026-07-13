/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CompressedId64Set, Id64String } from "@itwin/core-bentley";
import {
  Code, ElementGeometry, FlatBufferGeometryStream, GeometricElementProps, GeometryStreamProps, PlacementProps,
} from "@itwin/core-common";
import {
  AccuDrawHintBuilder, BeButton, BeButtonEvent, BriefcaseConnection, DecorateContext, GraphicType, HitDetail, IModelApp,
  NotifyMessageDetails, OutputMessagePriority,
  Tool, ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction,
  ToolAssistanceSection,
} from "@itwin/core-frontend";
import { IModelJson, LineString3d, Point3d, Range3d, Transform, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { editorBuiltInCmdIds } from "@itwin/editor-common";
import { basicManipulationIpc, CreateElementWithDynamicsTool, EditTools } from "@itwin/editor-frontend";
import { setTitle } from "./Title";
import { parseArgs } from "@itwin/frontend-devtools";

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
export class PlaceLineStringTool extends CreateElementWithDynamicsTool {
  public static override toolId = "PlaceLineString";
  private readonly _points: Point3d[] = [];
  private _current?: LineString3d;
  private _snapGeomId?: Id64String;
  private _startedCmd?: string;

  public override requireWriteableTarget(): boolean {
    // Inserting element will fail, but useful for testing AccuSnap and dynamics.
    return false;
  }

  protected async startCommand(): Promise<string> {
    if (undefined !== this._startedCmd)
      return this._startedCmd;
    return EditTools.startCommand<string>({ commandId: editorBuiltInCmdIds.cmdBasicManipulation, iModelKey: this.iModel.key });
  }

  protected override setupAccuDraw(): void {
    const nPts = this._points.length;
    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();

    // Rotate AccuDraw to last segment...
    if (nPts > 1 && !this._points[nPts - 1].isAlmostEqual(this._points[nPts - 2]))
      hints.setXAxis(Vector3d.createStartEnd(this._points[nPts - 2], this._points[nPts - 1]));

    hints.setOrigin(this._points[nPts - 1]);
    hints.sendHints();
  }

  protected override provideToolAssistance(_mainInstrText?: string, _additionalInstr?: ToolAssistanceInstruction[]): void {
    const nPts = this._points.length;
    const mainMsg = ToolAssistance.translatePrompt(0 === nPts ? "StartPoint" : (1 === nPts ? "EndPoint" : "IdentifyPoint"));
    const leftMsg = ToolAssistance.translateInput("AcceptPoint");
    const rightMsg = ToolAssistance.translateInput(nPts > 1 ? "Complete" : "Cancel");

    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, leftMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, leftMsg, false, ToolAssistanceInputMethod.Mouse));

    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, rightMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, rightMsg, false, ToolAssistanceInputMethod.Mouse));

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, mainMsg);
    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  public override testDecorationHit(id: Id64String): boolean {
    // Support snapping back to accepted segments during placement...
    return id === this._snapGeomId;
  }

  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    // Show tool name as locate tooltip when snapping to accepted segments...
    if (this.testDecorationHit(hit.sourceId))
      return this.description;
    return super.getToolTip(hit);
  }

  protected getSnapGeometry(): LineString3d | undefined {
    if (this._points.length < 2)
      return undefined;

    // Only snap to accepted segments...
    return LineString3d.create(this._points);
  }

  public override getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined {
    // Return geometry for accepted segments to use to compute snap points.
    const acceptedSegments = this.getSnapGeometry();
    if (undefined === acceptedSegments)
      return;

    const geomJson = IModelJson.Writer.toIModelJson(acceptedSegments);
    return geomJson ? [geomJson] : undefined;
  }

  public override decorate(context: DecorateContext): void {
    // Add accepted segments as a pickable decoration only for locate...
    const acceptedSegments = this.getSnapGeometry();
    if (undefined === acceptedSegments)
      return;

    if (undefined === this._snapGeomId)
      this._snapGeomId = this.iModel.transientIds.getNext();

    const builder = context.createGraphic({ type: GraphicType.WorldDecoration, pickable: { id: this._snapGeomId, locateOnly: true } });
    builder.addLineString(acceptedSegments.points);

    context.addDecorationFromBuilder(builder);
  }

  public override async updateElementData(ev: BeButtonEvent, isDynamics: boolean): Promise<void> {
    if (!isDynamics) {
      this._points.push(ev.point.clone());
    }

    const pts = isDynamics ? [...this._points, ev.point.clone()] : this._points;
    this._current = LineString3d.create(pts);
    if (isDynamics && !this._current && this._graphicsProvider) {
      this._graphicsProvider.cleanupGraphic(); // Don't continue displaying a prior successful result...
    }
  }

  protected override getPlacementProps(): PlacementProps | undefined {
    const vp = this.targetView;
    if (!vp || this._points.length < 1) {
      return undefined;
    }

    const origin = this._points[0];
    const angles = new YawPitchRollAngles();
    const matrix = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);
    ElementGeometry.Builder.placementAnglesFromPoints(this._points, matrix?.getColumn(2), angles);
    return { origin, angles };
  }

  protected override getGeometryProps(placement: PlacementProps): FlatBufferGeometryStream | undefined {
    if (!this._current) {
      return undefined;
    }

    const builder = new ElementGeometry.Builder();
    builder.setLocalToWorldFromPlacement(placement);
    if (!builder.appendGeometryQuery(this._current)) {
      return undefined;
    }

    return { format: "flatbuffer", data: builder.entries };
  }

  protected override getElementProps(placement: PlacementProps): GeometricElementProps | undefined {
    return {
      classFullName: "Generic:PhysicalObject",
      model: this.targetModelId,
      category: this.targetCategory,
      code: Code.createEmpty(),
      placement,
    };
  }

  protected override isComplete(ev: BeButtonEvent): boolean {
    return ev.button === BeButton.Reset && this._points.length > 1;
  }

  protected override async doCreateElement(props: GeometricElementProps): Promise<void> {
    this._startedCmd = await this.startCommand();
    await basicManipulationIpc.insertGeometricElement(props);
    return basicManipulationIpc.saveChanges(this.flyover);
  }

  protected override async cancelPoint(ev: BeButtonEvent): Promise<boolean> {
    // NOTE: Starting another tool will not create element...require reset or closure...
    if (this.isComplete(ev)) {
      await this.updateElementData(ev, false);
      await this.createElement();
    }

    return true;
  }

  public override async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this._points.length)
      return false;

    this._points.pop();
    if (0 === this._points.length) {
      await this.onReinitialize();
    } else {
      this.setupAndPromptForNextAction();
    }

    return true;
  }

  public async onRestartTool() {
    const tool = new PlaceLineStringTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

function compressIds(elementIds: string[]): CompressedId64Set {
  return CompressedId64Set.sortAndCompress(elementIds);
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
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 4; }

  public override async run(elementId: string | undefined, x: number, y: number, z: number): Promise<boolean> {

    if (!IModelApp.viewManager.selectedView) {
      return false;
    }
    const imodel = IModelApp.viewManager.selectedView.iModel;

    const elementIds = elementId ? [elementId] : Array.from(imodel.selectionSet.elements);
    if (imodel.isBriefcaseConnection()) {
      await transformElements(imodel, elementIds, Transform.createTranslationXYZ(x, y, z));
      await basicManipulationIpc.saveChanges(MoveElementTool.toolId);
    }

    return true;
  }

  /** Executes this tool's run method passing in the elementId and the offset.
   * @see [[run]]
   */
  public override async parseAndRun(...inputs: string[]): Promise<boolean> {
    const args = parseArgs(inputs);

    const elementId = args.get("e");
    const x = args.getFloat("x") ?? 0;
    const y = args.getFloat("y") ?? 0;
    const z = args.getFloat("z") ?? 0;

    return this.run(elementId, x, y, z);
  }
}

/** Automated repro for issue #1990: creates a dense circular line string at high coordinates
 * to demonstrate jagged curves caused by float32 precision loss during editing.
 *
 * Usage: `ReproJaggedCurves` — offset of 20,000,000 meters; forces absolute positions (jagged) to verify the threshold knob
 *        `ReproJaggedCurves x=5000000` — uses custom offset
 *        `ReproJaggedCurves x=0` — creates at origin (control case, should look smooth)
 *        `ReproJaggedCurves threshold=10000` — sets GraphicalEditingScope.dynamicGraphicsAbsolutePositionThreshold
 *
 * The tool:
 * 1. Enters editing scope if not already in one
 * 2. Sets the scope's `dynamicGraphicsAbsolutePositionThreshold` (default: Infinity, forcing absolute positions => jagged)
 * 3. Finds a spatial model and category from the current view
 * 4. Creates a circle (200-point line string, radius 5m) at the specified offset
 * 5. Saves and zooms to the element
 *
 * Absolute positions are used when `maxCoord < threshold`, and absolute positions are what cause the
 * jaggedness at high coords. So a *high* threshold (e.g. Infinity) yields jagged; a *low* threshold (e.g. the 10,000m default)
 * falls back to rtcCenter centering and stays smooth. Compare `threshold=Infinity` (jagged) vs `threshold=10000` (smooth) at
 * x=20000000.
 */
export class ReproJaggedCurvesTool extends Tool {
  public static override toolId = "ReproJaggedCurves";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 4; }

  public override async parseAndRun(...inputs: string[]): Promise<boolean> {
    const args = parseArgs(inputs);
    const x = args.getFloat("x") ?? 20_000_000;
    const y = args.getFloat("y") ?? 0;
    const z = args.getFloat("z") ?? 0;
    const threshold = args.getFloat("threshold") ?? Number.POSITIVE_INFINITY;
    return this.run(x, y, z, threshold);
  }

  public override async run(x = 20_000_000, y = 0, z = 0, threshold = Number.POSITIVE_INFINITY): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "No active viewport"));
      return false;
    }

    const imodel = vp.iModel;
    if (!imodel.isBriefcaseConnection()) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "iModel must be opened read-write (set IMJS_READ_WRITE=1)"));
      return false;
    }

    // Enter editing scope if not already in one
    if (!imodel.editingScope) {
      await imodel.enterEditingScope();
      setTitle(imodel);
    }

    // A high threshold forces absolute positions (jagged at high coords); a low one uses rtcCenter (smooth).
    imodel.editingScope!.dynamicGraphicsAbsolutePositionThreshold = threshold;
    console.log(`ReproJaggedCurves: dynamicGraphicsAbsolutePositionThreshold=${imodel.editingScope!.dynamicGraphicsAbsolutePositionThreshold}`); // eslint-disable-line no-console

    // Find model and category from the view's displayed models
    let modelId = imodel.editorToolSettings.model;
    let categoryId = imodel.editorToolSettings.category;

    if (!modelId) {
      const view = vp.view;
      if (view.isSpatialView()) {
        const models = view.modelSelector.models;
        if (models.size === 0) {
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "No spatial models displayed in view. Open a spatial view first."));
          return false;
        }
        modelId = models.values().next().value!;
        imodel.editorToolSettings.model = modelId;
      } else {
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "Requires a spatial view."));
        return false;
      }
    }

    if (!categoryId) {
      // Query for a spatial category from the iModel
      const rows: string[] = [];
      for await (const row of imodel.createQueryReader("SELECT ECInstanceId FROM bis.SpatialCategory LIMIT 1")) {
        rows.push(row[0] as string);
      }
      if (rows.length === 0) {
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "No spatial categories found in iModel."));
        return false;
      }
      categoryId = rows[0];
      imodel.editorToolSettings.category = categoryId;
    }

    // Generate a circle as a dense line string (200 points, radius 5m)
    // Points are in LOCAL coordinates relative to the placement origin (the circle center).
    const numPoints = 200;
    const radius = 5.0;
    const localPoints: Point3d[] = [];
    const worldPoints: Point3d[] = [];
    for (let i = 0; i <= numPoints; i++) {
      const angle = (2 * Math.PI * i) / numPoints;
      localPoints.push(new Point3d(radius * Math.cos(angle), radius * Math.sin(angle), 0));
      worldPoints.push(new Point3d(x + radius * Math.cos(angle), y + radius * Math.sin(angle), z));
    }

    const lineString = LineString3d.create(localPoints);
    const origin = new Point3d(x, y, z);
    const angles = new YawPitchRollAngles();
    const placement: PlacementProps = { origin, angles };

    // Build geometry as IModelJson (GeometryStreamProps) — coordinates are local to placement
    const geomJson = IModelJson.Writer.toIModelJson(lineString);
    if (!geomJson) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "Failed to serialize geometry"));
      return false;
    }

    const props: GeometricElementProps = {
      classFullName: "Generic:PhysicalObject",
      model: modelId,
      category: categoryId,
      code: Code.createEmpty(),
      placement,
      geom: [geomJson],
    };

    // Use worldPoints for range calculations (project extents, zoom)
    const elementRange = Range3d.createArray(worldPoints);
    console.log(`ReproJaggedCurves: elementRange=${JSON.stringify(elementRange.toJSON())}`); // eslint-disable-line no-console
    console.log(`ReproJaggedCurves: projectExtents=${JSON.stringify(imodel.projectExtents.toJSON())}`); // eslint-disable-line no-console
    if (!imodel.projectExtents.containsRange(elementRange)) {
      await startCommand(imodel);
      const extents = imodel.projectExtents.clone();
      extents.extendRange(elementRange);
      await basicManipulationIpc.updateProjectExtents(extents.toJSON());
      await basicManipulationIpc.saveChanges("ReproJaggedCurves-extents");
      imodel.projectExtents = extents;
      console.log(`ReproJaggedCurves: updated projectExtents=${JSON.stringify(extents.toJSON())}`); // eslint-disable-line no-console
    }

    // Now insert the element
    await startCommand(imodel);
    const elementId = await basicManipulationIpc.insertGeometricElement(props);
    await basicManipulationIpc.saveChanges("ReproJaggedCurves");
    console.log(`ReproJaggedCurves: inserted element ${elementId}`); // eslint-disable-line no-console

    // Zoom to the circle using an explicit range (more reliable than zoomToElements for new elements)
    imodel.selectionSet.replace(elementId);
    const zoomRange = elementRange.clone();
    zoomRange.expandInPlace(2); // pad slightly for visual context
    vp.zoomToVolume(zoomRange, { animateFrustumChange: true });
    console.log(`ReproJaggedCurves: zoomed to range=${JSON.stringify(zoomRange.toJSON())}`); // eslint-disable-line no-console

    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info,
      `Created circle at [${x}, ${y}, ${z}] — element ${elementId}. Model=${modelId}, Category=${categoryId}`,
    ));

    return true;
  }
}

export class SetEditorToolSettingsTool extends Tool {
  public static override toolId = "SetEditorToolSettings";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 2; }

  public override async parseAndRun(...inputArgs: string[]): Promise<boolean> {
    const args = parseArgs(inputArgs);
    return this.run(args.get("m"), args.get("c"));
  }

  public override async run(modelId?: string, categoryId?: string): Promise<boolean> {
    const iModel = IModelApp.viewManager.selectedView?.iModel;
    if (!iModel?.isBriefcaseConnection()) {
      return false;
    }

    if (modelId) {
      iModel.editorToolSettings.model = modelId;
    }

    if (categoryId) {
      iModel.editorToolSettings.category = categoryId;
    }

    return true;
  }
}
