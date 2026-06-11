/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BentleyError, CompressedId64Set, Id64String } from "@itwin/core-bentley";
import {
  Code, ElementGeometry, ElementGeometryDataEntry, FlatBufferGeometryStream, GeometricElementProps, GeometryStreamProps, PlacementProps,
} from "@itwin/core-common";
import {
  AccuDrawHintBuilder, BeButton, BeButtonEvent, BriefcaseConnection, DecorateContext, EventHandled, GraphicType, HitDetail, IModelApp,
  NotifyMessageDetails, OutputMessagePriority, PrimitiveTool,
  Tool, ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction,
  ToolAssistanceSection,
} from "@itwin/core-frontend";
import { IModelJson, LineString3d, Point3d, Transform, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { editorBuiltInCmdIds } from "@itwin/editor-common";
import { basicManipulationIpc, CreateElementWithDynamicsTool, EditTools } from "@itwin/editor-frontend";
import { setTitle } from "./Title";
import { parseArgs } from "@itwin/frontend-devtools";

// Simple tools for testing interactive editing. They require the iModel to have been opened in read-write mode.

/** Toggles whether dynamic tiles retain stale children as visual fallback during regeneration.
 * When enabled (default), prevents flicker but shows slightly stale graphics during edits.
 * When disabled, exhibits the original flicker behavior.
 */
export class ToggleStaleChildrenTool extends Tool {
  public static override toolId = "ToggleStaleChildren";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }

  public override async run(): Promise<boolean> {
    const ta = IModelApp.tileAdmin as any;
    ta.retainStaleDynamicTileChildren = !ta.retainStaleDynamicTileChildren;
    const state = ta.retainStaleDynamicTileChildren ? "ON (no flicker)" : "OFF (original flicker)";
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Retain stale dynamic tile children: ${state}`));
    return true;
  }
}

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

/** Interactively modifies the geometry stream of selected elements by dragging.
 * Unlike MoveElementTool (which only changes placement), this rewrites the GeometryStream
 * on every mouse motion — continuously committing changes so that dynamic tiles must
 * regenerate in real time. This exercises the code path that causes flicker.
 *
 * Usage: Select element(s), run "dta deform element", click anchor point, move mouse to
 * continuously deform. Click or reset to stop.
 */
export class DeformElementTool extends PrimitiveTool {
  public static override toolId = "DeformElement";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }

  private _anchorPoint?: Point3d;
  private _originalGeometry = new Map<Id64String, ElementGeometryDataEntry[]>();
  private _elementIds: Id64String[] = [];
  private _updating = false;
  private _pendingPoint?: Point3d;

  public override requireWriteableTarget(): boolean { return true; }

  public override async onPostInstall(): Promise<void> {
    await super.onPostInstall();

    const imodel = this.iModel;
    if (!imodel.isBriefcaseConnection()) {
      await this.exitTool();
      return;
    }

    this._elementIds = Array.from(imodel.selectionSet.elements);
    if (this._elementIds.length === 0) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, "DeformElement: select element(s) first"));
      await this.exitTool();
      return;
    }

    // Cache original geometry for all selected elements.
    await startCommand(imodel);
    for (const id of this._elementIds) {
      const geomInfo = await basicManipulationIpc.requestElementGeometry(id);
      if (geomInfo)
        this._originalGeometry.set(id, geomInfo.entryArray);
    }

    if (this._originalGeometry.size === 0) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, "DeformElement: no geometry found"));
      await this.exitTool();
      return;
    }

    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info,
      `DeformElement: click anchor point (${this._originalGeometry.size} element(s))`));
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!this._anchorPoint) {
      this._anchorPoint = ev.point.clone();
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "DeformElement: move mouse to deform, click or reset to stop"));
      return EventHandled.Yes;
    }

    // Second click — apply final position and restart.
    await this._applyTransform(ev.point);
    await this.onReinitialize();
    return EventHandled.Yes;
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (!this._anchorPoint)
      return;

    if (this._updating) {
      // Capture latest position so we apply it when the current update finishes.
      this._pendingPoint = ev.point.clone();
      return;
    }

    await this._applyTransform(ev.point);
  }

  public override async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    await this.onReinitialize();
    return EventHandled.Yes;
  }

  private async _applyTransform(currentPoint: Point3d): Promise<void> {
    if (!this._anchorPoint || this._updating)
      return;

    this._updating = true;
    try {
      const offset = currentPoint.minus(this._anchorPoint);
      const transform = Transform.createTranslationXYZ(offset.x, offset.y, offset.z);
      const imodel = this.iModel;
      if (!imodel.isBriefcaseConnection())
        return;

      await startCommand(imodel);
      for (const [id, originalEntries] of this._originalGeometry) {
        const newEntries = DeformElementTool._transformEntries(originalEntries, transform);
        if (newEntries)
          await basicManipulationIpc.updateGeometricElement(id, { entryArray: newEntries });
      }
      await basicManipulationIpc.saveChanges(DeformElementTool.toolId);
    } finally {
      this._updating = false;
    }

    // If mouse moved while we were busy, immediately apply the latest position.
    const pending = this._pendingPoint;
    if (pending) {
      this._pendingPoint = undefined;
      await this._applyTransform(pending);
    }
  }

  private static _transformEntries(entryArray: ElementGeometryDataEntry[], transform: Transform): ElementGeometryDataEntry[] | undefined {
    const builder = new ElementGeometry.Builder();
    let anyTransformed = false;

    for (const entry of entryArray) {
      const geom = ElementGeometry.toGeometryQuery(entry);
      if (geom) {
        const cloned = geom.clone();
        if (cloned && cloned.tryTransformInPlace(transform)) {
          builder.appendGeometryQuery(cloned);
          anyTransformed = true;
          continue;
        }
      }
      builder.entries.push(entry);
    }

    return anyTransformed ? builder.entries : undefined;
  }

  public override async onRestartTool(): Promise<void> {
    const tool = new DeformElementTool();
    if (!await tool.run())
      return this.exitTool();
  }
}
