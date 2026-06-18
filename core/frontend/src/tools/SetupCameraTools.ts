/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { Arc3d, AxisOrder, Constant, Matrix3d, Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { ColorDef, LinePixels } from "@itwin/core-common";
import { DialogItem, DialogProperty, DialogPropertySyncItem, PropertyDescriptionHelper } from "@itwin/appui-abstract";
import { AccuDrawHintBuilder } from "../AccuDraw";
import { IModelApp } from "../IModelApp";
import { createQuantityDescription } from "../properties/FormattedQuantityDescription";
import { DecorateContext } from "../ViewContext";
import { ScreenViewport, Viewport } from "../Viewport";
import { ViewStatus } from "../ViewStatus";
import { BeButtonEvent, CoreTools, EventHandled } from "./Tool";
import { PrimitiveTool } from "./PrimitiveTool";
import { ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction, ToolAssistanceSection } from "./ToolAssistance";
import { ToolSettings } from "./ToolSettings";
import { ViewTool } from "./ViewTool";
import { EditManipulator } from "./EditManipulator";
import { GraphicType } from "../common/render/GraphicType";

const viewHandleWeight = {
  normal: 1,
  bold: 2,
  thin: 0,
  fatDot: 3,
};

/** A tool that sets the view camera by two points. This is a PrimitiveTool and not a ViewTool to allow the view to be panned, zoomed, and rotated while defining the points.
 * To show tool settings for specifying camera and target heights above the snap point, make sure formatting and parsing data are cached before the tool starts
 * by calling QuantityFormatter.onInitialized at app startup.
 * @public
 */
export class SetupCameraTool extends PrimitiveTool {
  public static override toolId = "View.SetupCamera";
  public static override iconSpec = "icon-camera-location";
  public viewport?: ScreenViewport;
  protected _haveEyePt: boolean = false;
  protected _eyePtWorld: Point3d = Point3d.create();
  protected _targetPtWorld: Point3d = Point3d.create();

  public override isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.allow3dManipulations()); }
  public override isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; }
  public override requireWriteableTarget(): boolean { return false; }
  public override async onPostInstall() {
    await super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public override async onUnsuspend() { this.provideToolAssistance(); }
  protected setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    this.provideToolAssistance();
  }

  public override async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    if (this._haveEyePt)
      await this.onReinitialize();
    else
      await this.exitTool();

    return EventHandled.Yes;
  }

  protected provideToolAssistance(): void {
    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, ViewTool.translate(this._haveEyePt ? "SetupCamera.Prompts.NextPoint" : "SetupCamera.Prompts.FirstPoint"));
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    const acceptMsg = CoreTools.translate("ElementSet.Inputs.AcceptPoint");
    const rejectMsg = CoreTools.translate(this._haveEyePt ? "ElementSet.Inputs.Restart" : "ElementSet.Inputs.Exit");
    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, acceptMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, acceptMsg, false, ToolAssistanceInputMethod.Mouse));
    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, rejectMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, rejectMsg, false, ToolAssistanceInputMethod.Mouse));

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  public async onRestartTool(): Promise<void> {
    const tool = new SetupCameraTool();
    if (!await tool.run())
      return this.exitTool();
  }

  protected getAdjustedEyePoint() { return this.useCameraHeight ? this._eyePtWorld.plusScaled(Vector3d.unitZ(), this.cameraHeight) : this._eyePtWorld; }
  protected getAdjustedTargetPoint() { return this.useTargetHeight ? this._targetPtWorld.plusScaled(Vector3d.unitZ(), this.targetHeight) : this._targetPtWorld; }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport) {
      return EventHandled.Yes;
    } else if (undefined === this.viewport) {
      if (!ev.viewport.view.allow3dManipulations())
        return EventHandled.Yes;
      this.viewport = ev.viewport;
    } else if (this.viewport.view.iModel !== ev.viewport.view.iModel) {
      if (this._haveEyePt)
        return EventHandled.Yes;
      this.viewport = ev.viewport;
      return EventHandled.Yes;
    }

    if (this._haveEyePt) {
      this._targetPtWorld.setFrom(ev.point);
      this.doManipulation();
      await this.onReinitialize();
    } else {
      this._eyePtWorld.setFrom(ev.point);
      this._targetPtWorld.setFrom(this._eyePtWorld);
      this._haveEyePt = true;
      this.setupAndPromptForNextAction();
    }

    return EventHandled.Yes;
  }

  public override async onMouseMotion(ev: BeButtonEvent) {
    if (!this._haveEyePt)
      return;
    this._targetPtWorld.setFrom(ev.point);
    IModelApp.viewManager.invalidateDecorationsAllViews();
  }

  public static drawCameraFrustum(context: DecorateContext, vp: ScreenViewport, eyePtWorld: Point3d, targetPtWorld: Point3d, eyeSnapPtWorld?: Point3d, targetSnapPtWorld?: Point3d) {
    if (!vp.view.is3d() || vp.view.iModel !== context.viewport.view.iModel)
      return;

    const zVec = Vector3d.createStartEnd(eyePtWorld, targetPtWorld);
    const focusDist = zVec.normalizeWithLength(zVec).mag;
    if (focusDist <= Constant.oneMillimeter) // eye and target are too close together
      return;

    const xVec = new Vector3d();
    const yVec = Vector3d.unitZ();
    if (yVec.crossProduct(zVec).normalizeWithLength(xVec).mag < (1e-8))
      return;
    if (zVec.crossProduct(xVec).normalizeWithLength(yVec).mag < (1e-8))
      return;

    const lensAngle = ToolSettings.walkCameraAngle;
    const extentX = Math.tan(lensAngle.radians / 2.0) * focusDist;
    const extentY = extentX * (vp.view.extents.y / vp.view.extents.x);

    const pt1 = targetPtWorld.plusScaled(xVec, -extentX);
    pt1.plusScaled(yVec, extentY, pt1);
    const pt2 = targetPtWorld.plusScaled(xVec, extentX);
    pt2.plusScaled(yVec, extentY, pt2);
    const pt3 = targetPtWorld.plusScaled(xVec, extentX);
    pt3.plusScaled(yVec, -extentY, pt3);
    const pt4 = targetPtWorld.plusScaled(xVec, -extentX);
    pt4.plusScaled(yVec, -extentY, pt4);

    const color = EditManipulator.HandleUtils.adjustForBackgroundColor(ColorDef.black, vp);
    const builderHid = context.createGraphicBuilder(GraphicType.WorldOverlay);

    builderHid.setSymbology(color, color, viewHandleWeight.bold);
    builderHid.addLineString([eyePtWorld, targetPtWorld]);

    builderHid.setSymbology(color, color, viewHandleWeight.thin, LinePixels.Code2);
    builderHid.addLineString([eyePtWorld, pt1]);
    builderHid.addLineString([eyePtWorld, pt2]);
    builderHid.addLineString([eyePtWorld, pt3]);
    builderHid.addLineString([eyePtWorld, pt4]);
    builderHid.addLineString([pt1, pt2, pt3, pt4, pt1]);

    if (eyeSnapPtWorld)
      builderHid.addLineString([eyeSnapPtWorld, eyePtWorld]);
    if (targetSnapPtWorld)
      builderHid.addLineString([targetSnapPtWorld, targetPtWorld]);

    builderHid.setSymbology(color, color, viewHandleWeight.fatDot);
    builderHid.addPointString([eyePtWorld, targetPtWorld]);

    if (eyeSnapPtWorld)
      builderHid.addPointString([eyeSnapPtWorld]);
    if (targetSnapPtWorld)
      builderHid.addPointString([targetSnapPtWorld]);

    context.addDecorationFromBuilder(builderHid);

    const backColor = ColorDef.from(0, 0, 255, 200);
    const sideColor = context.viewport.hilite.color.withAlpha(25);
    const builderVis = context.createGraphicBuilder(GraphicType.WorldDecoration);

    builderVis.setSymbology(color, color, viewHandleWeight.normal);
    builderVis.addLineString([eyePtWorld, pt1]);
    builderVis.addLineString([eyePtWorld, pt2]);
    builderVis.addLineString([eyePtWorld, pt3]);
    builderVis.addLineString([eyePtWorld, pt4]);
    builderVis.addLineString([pt1, pt2, pt3, pt4, pt1]);

    builderVis.setSymbology(color, backColor, viewHandleWeight.thin);
    builderVis.addShape([pt1, pt2, pt3, pt4]);

    builderVis.setSymbology(color, sideColor, viewHandleWeight.thin);
    builderVis.addShape([eyePtWorld, pt1, pt2]);
    builderVis.addShape([eyePtWorld, pt2, pt3]);
    builderVis.addShape([eyePtWorld, pt3, pt4]);
    builderVis.addShape([eyePtWorld, pt4, pt1]);

    context.addDecorationFromBuilder(builderVis);
  }

  public override decorate(context: DecorateContext): void {
    if (!this._haveEyePt || undefined === this.viewport)
      return;
    SetupCameraTool.drawCameraFrustum(context, this.viewport, this.getAdjustedEyePoint(), this.getAdjustedTargetPoint(), this.useCameraHeight ? this._eyePtWorld : undefined, this.useTargetHeight ? this._targetPtWorld : undefined);
  }

  public override decorateSuspended(context: DecorateContext): void { this.decorate(context); }

  private doManipulation(): void {
    const vp = this.viewport;
    if (undefined === vp)
      return;

    const view = vp.view;
    if (!view.is3d() || !view.allow3dManipulations())
      return;

    const eyePoint = this.getAdjustedEyePoint();
    const targetPoint = this.getAdjustedTargetPoint();
    const lensAngle = ToolSettings.walkCameraAngle;
    if (ViewStatus.Success !== view.lookAt({ eyePoint, targetPoint, upVector: Vector3d.unitZ(), lensAngle }))
      return;

    vp.synchWithView({ animateFrustumChange: true });
  }

  private _useCameraHeightProperty: DialogProperty<boolean> | undefined;
  public get useCameraHeightProperty() {
    if (!this._useCameraHeightProperty)
      this._useCameraHeightProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildLockPropertyDescription("useCameraHeight"), false, undefined, false);
    return this._useCameraHeightProperty;
  }
  public get useCameraHeight(): boolean { return this.useCameraHeightProperty.value; }
  public set useCameraHeight(option: boolean) { this.useCameraHeightProperty.value = option; }

  private _cameraHeightProperty: DialogProperty<number> | undefined;
  public get cameraHeightProperty() {
    if (!this._cameraHeightProperty)
      this._cameraHeightProperty = new DialogProperty<number>(createQuantityDescription({
        name: "cameraHeight",
        displayLabel: ViewTool.translate("SetupCamera.Labels.CameraHeight"),
        kindOfQuantityName: "DefaultToolsUnits.LENGTH",
        persistenceUnitName: "Units.M",
      }), 0.0);
    return this._cameraHeightProperty;
  }
  public get cameraHeight(): number { return this.cameraHeightProperty.value; }
  public set cameraHeight(value: number) { this.cameraHeightProperty.value = value; }

  private _useTargetHeightProperty: DialogProperty<boolean> | undefined;
  public get useTargetHeightProperty() {
    if (!this._useTargetHeightProperty)
      this._useTargetHeightProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildLockPropertyDescription("useTargetHeight"), false, undefined, false);
    return this._useTargetHeightProperty;
  }
  public get useTargetHeight(): boolean { return this.useTargetHeightProperty.value; }
  public set useTargetHeight(value: boolean) { this.useTargetHeightProperty.value = value; }

  private _targetHeightProperty: DialogProperty<number> | undefined;
  public get targetHeightProperty() {
    if (!this._targetHeightProperty)
      this._targetHeightProperty = new DialogProperty<number>(createQuantityDescription({
        name: "targetHeight",
        displayLabel: ViewTool.translate("SetupCamera.Labels.TargetHeight"),
        kindOfQuantityName: "DefaultToolsUnits.LENGTH",
        persistenceUnitName: "Units.M",
      }), 0.0);
    return this._targetHeightProperty;
  }
  public get targetHeight(): number { return this.targetHeightProperty.value; }
  public set targetHeight(value: number) { this.targetHeightProperty.value = value; }

  protected override getToolSettingLockProperty(property: DialogProperty<any>): DialogProperty<boolean> | undefined {
    if (property === this.cameraHeightProperty)
      return this.useCameraHeightProperty;
    else if (property === this.targetHeightProperty)
      return this.useTargetHeightProperty;
    return undefined;
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.useCameraHeightProperty, this.useTargetHeightProperty, this.cameraHeightProperty, this.targetHeightProperty]);

    const cameraHeightLock = this.useCameraHeightProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 });
    const targetHeightLock = this.useTargetHeightProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 });

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.cameraHeightProperty.toDialogItem({ rowPriority: 1, columnIndex: 1 }, cameraHeightLock));
    toolSettings.push(this.targetHeightProperty.toDialogItem({ rowPriority: 2, columnIndex: 1 }, targetHeightLock));
    return toolSettings;
  }
}

/** A tool that sets a walk tool starting position by a floor point and look direction. This is a PrimitiveTool and not a ViewTool to allow the view to be panned, zoomed, and rotated while defining the points.
 * @public
 */
export class SetupWalkCameraTool extends PrimitiveTool {
  public static override toolId = "View.SetupWalkCamera";
  public static override iconSpec = "icon-camera-location";
  public viewport?: ScreenViewport;
  protected _haveEyePt: boolean = false;
  protected _eyePtWorld: Point3d = Point3d.create();
  protected _targetPtWorld: Point3d = Point3d.create();

  public override isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.allow3dManipulations()); }
  public override isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; }
  public override requireWriteableTarget(): boolean { return false; }
  public override async onPostInstall() {
    await super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public override async onUnsuspend() { this.provideToolAssistance(); }
  protected setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    this.provideToolAssistance();
  }

  public override async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    if (this._haveEyePt)
      await this.onReinitialize();
    else
      await this.exitTool();

    return EventHandled.Yes;
  }

  protected provideToolAssistance(): void {
    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, ViewTool.translate(this._haveEyePt ? "SetupWalkCamera.Prompts.NextPoint" : "SetupWalkCamera.Prompts.FirstPoint"));
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    const acceptMsg = CoreTools.translate("ElementSet.Inputs.AcceptPoint");
    const rejectMsg = CoreTools.translate(this._haveEyePt ? "ElementSet.Inputs.Restart" : "ElementSet.Inputs.Exit");
    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, acceptMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, acceptMsg, false, ToolAssistanceInputMethod.Mouse));
    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, rejectMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, rejectMsg, false, ToolAssistanceInputMethod.Mouse));

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  public async onRestartTool(): Promise<void> {
    const tool = new SetupWalkCameraTool();
    if (!await tool.run())
      return this.exitTool();
  }

  protected getAdjustedEyePoint() { return this._eyePtWorld.plusScaled(Vector3d.unitZ(), ToolSettings.walkEyeHeight); }
  protected getAdjustedTargetPoint() { return Point3d.create(this._targetPtWorld.x, this._targetPtWorld.y, this.getAdjustedEyePoint().z); }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport) {
      return EventHandled.Yes;
    } else if (undefined === this.viewport) {
      if (!ev.viewport.view.allow3dManipulations())
        return EventHandled.Yes;
      this.viewport = ev.viewport;
    } else if (this.viewport.view.iModel !== ev.viewport.view.iModel) {
      if (this._haveEyePt)
        return EventHandled.Yes;
      this.viewport = ev.viewport;
      return EventHandled.Yes;
    }

    if (this._haveEyePt) {
      this._targetPtWorld.setFrom(ev.point);
      this.doManipulation();
      await this.onReinitialize();
    } else {
      this._eyePtWorld.setFrom(ev.point);
      this._targetPtWorld.setFrom(this._eyePtWorld);
      this._haveEyePt = true;
      this.setupAndPromptForNextAction();
    }

    return EventHandled.Yes;
  }

  public override async onMouseMotion(ev: BeButtonEvent) {
    if (!this._haveEyePt)
      return;
    this._targetPtWorld.setFrom(ev.point);
    IModelApp.viewManager.invalidateDecorationsAllViews();
  }

  private static getFigurePoints(): Point3d[] {
    const figurePts: Point3d[] = [];
    figurePts.push(Point3d.create(1.064, -0.014));
    figurePts.push(Point3d.create(1.051, 0.039));
    figurePts.push(Point3d.create(1.008, 0.058));
    figurePts.push(Point3d.create(0.962, 0.048));
    figurePts.push(Point3d.create(0.920, 0.026));
    figurePts.push(Point3d.create(0.898, 0.026));
    figurePts.push(Point3d.create(0.853, 0.094));
    figurePts.push(Point3d.create(0.741, 0.120));
    figurePts.push(Point3d.create(0.652, 0.091));
    figurePts.push(Point3d.create(0.514, 0.107));
    figurePts.push(Point3d.create(0.304, 0.108));
    figurePts.push(Point3d.create(0.040, 0.135));
    figurePts.push(Point3d.create(-0.023, 0.133));
    figurePts.push(Point3d.create(-0.031, 0.088));
    figurePts.push(Point3d.create(0.041, 0.068));
    figurePts.push(Point3d.create(0.299, 0.035));
    figurePts.push(Point3d.create(0.447, -0.015));
    figurePts.push(Point3d.create(0.267, -0.042));
    figurePts.push(Point3d.create(0.019, -0.036));
    figurePts.push(Point3d.create(-0.027, -0.146));
    figurePts.push(Point3d.create(-0.005, -0.179));
    figurePts.push(Point3d.create(0.056, -0.108));
    figurePts.push(Point3d.create(0.270, -0.122));
    figurePts.push(Point3d.create(0.483, -0.120));
    figurePts.push(Point3d.create(0.649, -0.145));
    figurePts.push(Point3d.create(0.715, -0.186));
    figurePts.push(Point3d.create(0.865, -0.135));
    figurePts.push(Point3d.create(0.905, -0.039));
    figurePts.push(Point3d.create(0.948, -0.035));
    figurePts.push(Point3d.create(0.979, -0.051));
    figurePts.push(Point3d.create(1.037, -0.046));
    figurePts.push(figurePts[0].clone());
    return figurePts;
  }

  private static getFigureTransform(vp: Viewport, base: Point3d, direction: Vector3d, scale: number): Transform | undefined {
    const boresite = AccuDrawHintBuilder.getBoresite(base, vp);
    if (Math.abs(direction.dotProduct(boresite.direction)) >= 0.9999)
      return undefined;

    const matrix = Matrix3d.createRigidFromColumns(direction, boresite.direction, AxisOrder.XZY);
    if (undefined === matrix)
      return undefined;

    matrix.scaleColumnsInPlace(scale, scale, scale);
    return Transform.createRefs(base.clone(), matrix);
  }

  public static drawFigure(context: DecorateContext, vp: Viewport, groundPt: Point3d, eyeHeight: number): void {
    if (!vp.view.is3d() || vp.view.iModel !== context.viewport.view.iModel)
      return;

    const transform = this.getFigureTransform(context.viewport, groundPt, Vector3d.unitZ(), eyeHeight);
    if (undefined === transform)
      return;

    const figurePts = this.getFigurePoints();
    const color = EditManipulator.HandleUtils.adjustForBackgroundColor(ColorDef.black, vp);
    const fill = ColorDef.from(255, 245, 225, 100);

    const builderShadow = context.createGraphicBuilder(GraphicType.WorldOverlay);
    builderShadow.setSymbology(color, ColorDef.black.withAlpha(30), viewHandleWeight.thin);
    builderShadow.addArc(Arc3d.createXY(groundPt, eyeHeight * 0.22), true, true);
    context.addDecorationFromBuilder(builderShadow);

    const builderHid = context.createGraphicBuilder(GraphicType.WorldDecoration, transform);
    builderHid.setSymbology(color, fill, viewHandleWeight.thin);
    builderHid.addShape(figurePts); // Copies points...
    context.addDecorationFromBuilder(builderHid);

    const builderVis = context.createGraphicBuilder(GraphicType.WorldOverlay, transform);
    builderVis.setSymbology(color, color, viewHandleWeight.normal);
    builderVis.addLineString(figurePts); // Owns points...
    context.addDecorationFromBuilder(builderVis);
  }

  public override decorate(context: DecorateContext): void {
    if (!this._haveEyePt || undefined === this.viewport)
      return;
    SetupWalkCameraTool.drawFigure(context, this.viewport, this._eyePtWorld, ToolSettings.walkEyeHeight);
    SetupCameraTool.drawCameraFrustum(context, this.viewport, this.getAdjustedEyePoint(), this.getAdjustedTargetPoint(), this._eyePtWorld, this._targetPtWorld);
  }

  public override decorateSuspended(context: DecorateContext): void { this.decorate(context); }

  private doManipulation(): void {
    const vp = this.viewport;
    if (undefined === vp)
      return;

    const view = vp.view;
    if (!view.is3d() || !view.allow3dManipulations())
      return;

    const eyePoint = this.getAdjustedEyePoint();
    const targetPoint = this.getAdjustedTargetPoint();
    const lensAngle = ToolSettings.walkCameraAngle;
    if (ViewStatus.Success !== view.lookAt({ eyePoint, targetPoint, upVector: Vector3d.unitZ(), lensAngle }))
      return;

    vp.synchWithView({ animateFrustumChange: true });
  }
}
