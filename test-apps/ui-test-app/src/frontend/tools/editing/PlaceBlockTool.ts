/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore picklist

import { assert } from "@bentley/bentleyjs-core";
import { AxisOrder, IModelJson, LinearSweep, Matrix3d, Point3d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { Code, ColorDef, LinePixels, PhysicalElementProps } from "@bentley/imodeljs-common";
import {
  AccuDrawHintBuilder, BeButtonEvent, CoreTools, DecorateContext, EditManipulator, EventHandled, GraphicType, IModelApp, ToolAssistance,
  ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction, ToolAssistanceSection, Viewport,
} from "@bentley/imodeljs-frontend";
import { PrimitiveToolEx } from "./PrimitiveToolEx";

function translate(prompt: string) {
  return IModelApp.i18n.translate(`SampleApp:tools.PlaceBlockTool.${prompt}`);
}

/* eslint-disable deprecation/deprecation */

export class PlaceBlockTool extends PrimitiveToolEx {
  public static toolId = "PlaceBlock";
  public static iconSpec = "icon-cube-faces-bottom";
  protected readonly _points: Point3d[] = [];
  protected _matrix?: Matrix3d;
  protected _isComplete = false;
  public height = 2.75;
  public story = "1";

  protected allowView(_vp: Viewport) { return true; } // vp.view.isSpatialView() || vp.view.isDrawingView(); }
  public isCompatibleViewport(vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean { return (undefined !== vp && this.allowView(vp)); }
  public isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; }
  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }
  public onUnsuspend(): void { this.showPrompt(); }

  protected showPrompt(): void {
    const mainMsg = (0 === this._points.length) ? "prompts.firstPoint" : (1 === this._points.length) ? "prompts.nextPoint" : "prompts.additionalPoint";
    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, translate(mainMsg));
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    const acceptMsg = CoreTools.translate(this._isComplete ? "ElementSet.Inputs.Restart" : "ElementSet.Inputs.AcceptPoint");
    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, acceptMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, acceptMsg, false, ToolAssistanceInputMethod.Mouse));

    const resetMsg = CoreTools.translate("ElementSet.Inputs.Restart");
    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, resetMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, resetMsg, false, ToolAssistanceInputMethod.Mouse));

    if (this._points.length > 1)
      mouseInstructions.push(ToolAssistance.createModifierKeyInstruction(ToolAssistance.ctrlKey, ToolAssistanceImage.LeftClick, CoreTools.translate("ElementSet.Inputs.AdditionalPoint"), false, ToolAssistanceInputMethod.Mouse));
    if (0 !== this._points.length)
      mouseInstructions.push(ToolAssistance.createKeyboardInstruction(ToolAssistance.createKeyboardInfo([ToolAssistance.ctrlKey, "Z"]), CoreTools.translate("ElementSet.Inputs.UndoLastPoint"), false, ToolAssistanceInputMethod.Mouse));

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  protected setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    this.showPrompt();

    if (this._isComplete) {
      AccuDrawHintBuilder.deactivate();
      return;
    }

    if (0 === this._points.length)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.setOrigin(this._points[this._points.length - 1]);
    if (1 === this._points.length) {
      hints.setRotation(this._matrix!.inverse()!);
      hints.setModeRectangular();
    } else if (this._points.length > 1 && !(this._points[this._points.length - 1].isAlmostEqual(this._points[this._points.length - 2]))) {
      const xVec = Vector3d.createStartEnd(this._points[this._points.length - 2], this._points[this._points.length - 1]);
      const zVec = this._matrix!.getColumn(2);
      const matrix = Matrix3d.createRigidFromColumns(xVec, zVec, AxisOrder.XZY);
      if (undefined !== matrix)
        hints.setRotation(matrix.inverse()!); // Rotate AccuDraw x axis to last segment preserving current up vector...
    }
    hints.setLockZ = true;
    hints.sendHints();
  }

  protected getShapePoints(ev: BeButtonEvent): Point3d[] {
    const points: Point3d[] = [];
    if (undefined === this.targetView || this._points.length < 1)
      return points;
    for (const pt of this._points)
      points.push(pt.clone());

    if (this._isComplete)
      return points;

    const normal = this._matrix!.getColumn(2);
    let currentPt = EditManipulator.HandleUtils.projectPointToPlaneInView(ev.point, points[0], normal, ev.viewport!, true);
    if (undefined === currentPt)
      currentPt = ev.point.clone();
    if (2 === points.length && !ev.isControlKey) {
      const xDir = Vector3d.createStartEnd(points[0], points[1]);
      const xLen = xDir.magnitude(); xDir.normalizeInPlace();
      const yDir = xDir.crossProduct(normal); yDir.normalizeInPlace();
      const cornerPt = EditManipulator.HandleUtils.projectPointToLineInView(currentPt, points[1], yDir, ev.viewport!, true);
      if (undefined !== cornerPt) {
        points.push(cornerPt);
        cornerPt.plusScaled(xDir, -xLen, currentPt);
      }
    }
    points.push(currentPt);

    if (points.length > 2)
      points.push(points[0].clone());

    return points;
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport !== this.targetView)
      return;

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    if (undefined === ev.viewport)
      return;
    const points = this.getShapePoints(ev);
    if (points.length < 2)
      return;

    const builderAccVis = context.createGraphicBuilder(GraphicType.WorldDecoration);
    const builderAccHid = context.createGraphicBuilder(GraphicType.WorldOverlay);
    const colorAccVis = ColorDef.white.adjustedForContrast(context.viewport.view.backgroundColor);
    const colorAccHid = colorAccVis.withAlpha(100);
    const fillAccVis = context.viewport.hilite.color.withAlpha(50);

    builderAccVis.setSymbology(colorAccVis, fillAccVis, 3);
    builderAccHid.setSymbology(colorAccHid, fillAccVis, 1, LinePixels.Code2);

    if (points.length > 2)
      builderAccHid.addShape(points);

    builderAccVis.addLineString(points);
    builderAccHid.addLineString(points);

    context.addDecorationFromBuilder(builderAccVis);
    context.addDecorationFromBuilder(builderAccHid);
  }

  public decorateSuspended(context: DecorateContext): void { if (this._isComplete) this.decorate(context); }
  public async onMouseMotion(ev: BeButtonEvent): Promise<void> { if (this._points.length > 0 && undefined !== ev.viewport && !this._isComplete) ev.viewport.invalidateDecorations(); }

  private async createElement(): Promise<void> {
    assert(this._matrix !== undefined, "should have defined orientation by now");

    // We know that all points lie on a plane.
    const angles = YawPitchRollAngles.createFromMatrix3d(this._matrix);
    const origin = this._points[0];
    const xyPoints = this._points.map((pt: Point3d) => ({ x: pt.x - origin.x, y: pt.y - origin.y }));

    const primitive = LinearSweep.createZSweep(xyPoints, 0.0, this.height, true);

    const geomProps = IModelJson.Writer.toIModelJson(primitive);

    const model = this.targetModelId;
    const category = this.targetCategory;

    const props3d: PhysicalElementProps = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty() };

    return this.editorConnection.createElement(props3d, origin, angles, geomProps);
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.targetView)
      return EventHandled.No;

    await this.ensureEditorConnection();

    if (this._isComplete)
      this.onReinitialize();

    if (this._points.length === 0) {
      await this.lockTargetModel();
    }

    if (this._points.length > 1 && !ev.isControlKey) {
      const points = this.getShapePoints(ev);
      if (points.length < 3)
        return EventHandled.No;

      this._isComplete = true;
      this._points.length = 0;
      for (const pt of points) this._points.push(pt);

      await this.createElement();
      await this.editorConnection.write();

      // const extents = await this.iModel.models.queryModelRanges([this.targetModelId]);
      // await this.iModel.editing.updateProjectExtents(Range3d.fromJSON(extents[0]));

      await this.saveChanges();

      this.setupAndPromptForNextAction();
      return EventHandled.No;
    }

    // TODO: Get orientation from AccuDraw
    // AccuDraw.getCurrentOrientation ...
    if (undefined === this._matrix && undefined === (this._matrix = EditManipulator.HandleUtils.getRotation(EditManipulator.RotationType.Top, this.targetView)))
      return EventHandled.No;

    const currPt = ev.point.clone();
    if (this._points.length > 0) {
      const planePt = EditManipulator.HandleUtils.projectPointToPlaneInView(currPt, this._points[0], this._matrix.getColumn(2), ev.viewport!, true);
      if (undefined !== planePt)
        currPt.setFrom(planePt);
    }

    this._points.push(currPt);
    this.setupAndPromptForNextAction();

    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize();
    return EventHandled.No;
  }

  public onReinitialize(): void {
    this._isComplete = false;
    this._points.length = 0;
    this._matrix = undefined;
    AccuDrawHintBuilder.deactivate();
    this.setupAndPromptForNextAction();
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this._points.length || this._isComplete)
      return false;

    this._points.pop();
    this.setupAndPromptForNextAction();
    return true;
  }

  public onRestartTool(): void {
    const tool = new PlaceBlockTool();
    if (!tool.run())
      this.exitTool();
  }
}
