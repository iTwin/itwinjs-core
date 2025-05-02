/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CompressedId64Set } from "@itwin/core-bentley";
import {
  Code, ElementGeometry, FlatBufferGeometryStream, GeometricElementProps, PlacementProps,
} from "@itwin/core-common";
import {
  AccuDrawHintBuilder, BeButton, BeButtonEvent, BriefcaseConnection, CoreTools, IModelApp,
  Tool, ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction,
  ToolAssistanceSection,
} from "@itwin/core-frontend";
import { LineString3d, Point3d, Transform, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
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
  private _startedCmd?: string;

  protected override get wantAccuSnap(): boolean { return true; }
  protected override get wantDynamics(): boolean { return true; }
  public override requireWriteableTarget(): boolean {
    // Inserting element will fail, but useful for testing AccuSnap and dynamics.
    return false;
  }

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
    return this.saveChanges();
  }

  protected override async cancelPoint(ev: BeButtonEvent): Promise<boolean> {
    // NOTE: Starting another tool will not create element...require reset or closure...
    if (this.isComplete(ev)) {
      await this.updateElementData(ev, false);
      await this.createElement();
    }

    return true;
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
