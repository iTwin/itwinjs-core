/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, PrimitiveTool, BeButtonEvent, EventHandled, Viewport, EditManipulator, AccuDrawHintBuilder, DecorateContext, CanvasDecoration, ToolAssistance, ToolAssistanceSection, ToolAssistanceInstruction, ToolAssistanceImage, ToolAssistanceInputMethod, CoreTools } from "@bentley/imodeljs-frontend";
import { Point3d, Vector3d, Matrix3d, Ray3d, Angle, XYAndZ } from "@bentley/geometry-core";
import { Cartographic } from "@bentley/imodeljs-common";
import { ProjectExtentsClipDecoration } from "./ProjectExtentsDecoration";
import { translatePrompt } from "./ProjectLocation";

/** @internal */
class LabelDecoration implements CanvasDecoration {
  public worldLocation = new Point3d();
  public position = new Point3d();
  public label: string;

  constructor(worldLocation: XYAndZ, label: string) {
    this.worldLocation.setFrom(worldLocation);
    this.label = label;
  }

  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    ctx.font = "16px san-serif";
    const labelHeight = ctx.measureText("M").width; // Close enough for border padding...
    const labelWidth = ctx.measureText(this.label).width + labelHeight;

    ctx.lineWidth = 1;
    ctx.strokeStyle = "white";
    ctx.fillStyle = "rgba(0,0,0,.4)";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 10;
    ctx.fillRect(-(labelWidth / 2), -labelHeight, labelWidth, labelHeight * 2);
    ctx.strokeRect(-(labelWidth / 2), -labelHeight, labelWidth, labelHeight * 2);

    ctx.fillStyle = "white";
    ctx.shadowBlur = 0;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label, 0, 0);
  }

  public setPosition(vp: Viewport): boolean {
    vp.worldToView(this.worldLocation, this.position);
    this.position.y -= Math.floor(vp.pixelsFromInches(0.45)) + 0.5; // Offset from world location...
    return vp.viewRect.containsPoint(this.position);
  }

  public addDecoration(context: DecorateContext) {
    if (this.setPosition(context.viewport))
      context.addCanvasDecoration(this);
  }
}

/** Change or update geolocation for project.
 * To show tool settings for specifying lat/long, make sure formatting and parsing data are cached before the tool starts
 * by calling QuantityFormatter.onInitialized at app startup.
 * @beta
 */
export class ProjectGeolocationPointTool extends PrimitiveTool {
  public static toolId = "ProjectLocation.Geolocation.Point";
  public static iconSpec = "icon-globe"; // <== Tool button should use whatever icon you have here...
  protected _accept = false;
  protected _scale = 1.0;
  protected _origin?: Point3d;
  protected _labelDeco?: LabelDecoration;

  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.isSpatialView()); }
  public isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; } // Allow snapping to terrain, etc. outside project extents...
  public requireWriteableTarget(): boolean { return false; } // Tool doesn't modify the imodel...
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }
  public onCleanup() { super.onCleanup(); this.unsuspendDecorations(); }
  public onRestartTool(): void { this.exitTool(); }
  public onUnsuspend(): void { this.provideToolAssistance(); }

  protected provideToolAssistance(): void {
    const acceptMsg = CoreTools.translate(undefined === this._origin ? "ElementSet.Inputs.AcceptPoint" : "ElementSet.Inputs.Accept");
    const rejectMsg = CoreTools.translate("ElementSet.Inputs.Cancel");
    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, translatePrompt(undefined === this._origin ? "IdentifyRefPoint" : "ConfirmCoordinates"));
    const sections: ToolAssistanceSection[] = [];

    const mouseInstructions: ToolAssistanceInstruction[] = [];
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, acceptMsg, false, ToolAssistanceInputMethod.Mouse));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, rejectMsg, false, ToolAssistanceInputMethod.Mouse));
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));

    const touchInstructions: ToolAssistanceInstruction[] = [];
    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, acceptMsg, false, ToolAssistanceInputMethod.Touch));
    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, rejectMsg, false, ToolAssistanceInputMethod.Touch));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  protected setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(!this._accept);
    this.provideToolAssistance();
  }

  private pulseDecoration() {
    if (!this._accept)
      return;

    const deco = ProjectExtentsClipDecoration.get();
    if (undefined === deco)
      return;

    this._scale += 0.1;
    if (this._scale > 1.6)
      this._scale = 1.0;

    deco.viewport.invalidateDecorations();
    setTimeout(() => { this.pulseDecoration(); }, 100);
  }

  private unsuspendDecorations() {
    const deco = ProjectExtentsClipDecoration.get();
    if (undefined !== deco)
      deco.suspendGeolocationDecorations = false;
  }

  public decorate(context: DecorateContext): void {
    if (undefined === this._origin)
      return;

    const deco = ProjectExtentsClipDecoration.get();
    if (undefined === deco)
      return;

    deco.suspendGeolocationDecorations = true;
    deco.drawMonumentPoint(context, this._origin, this._scale);

    if (undefined !== this._labelDeco)
      this._labelDeco.addDecoration(context);
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined === ev.viewport || this._accept)
      return;

    this._origin = ev.point.clone();
    ev.viewport.invalidateDecorations();
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize(); // Calls onRestartTool to exit...
    return EventHandled.No;
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport)
      return EventHandled.No; // Shouldn't really happen...

    if (!this._accept) {
      // ### TODO Synch tool settings w/current lat/long/alt/angle...
      this._accept = true; // Require explict accept to give user a chance to change values...
      this._origin = ev.point.clone();
      this._labelDeco = new LabelDecoration(this._origin, translatePrompt("SpecifyCoordinates"));
      this.setupAndPromptForNextAction();
      this.pulseDecoration(); // Pulse to indicate that we are waiting for user input...
      return EventHandled.No;
    }

    this._accept = false;
    this._scale = 1.0;
    const deco = ProjectExtentsClipDecoration.get();
    if (undefined !== deco) {
      const origin = new Cartographic(Angle.createDegrees(2.35).radians, Angle.createDegrees(48.85).radians); // ### TODO: Need UI for lat/long/alt/angle...
      deco.updateEcefLocation(origin, this._origin);
    }

    this.onReinitialize(); // Calls onRestartTool to exit...
    return EventHandled.No;
  }

  public onInstall(): boolean { return ProjectExtentsClipDecoration.allowEcefLocationChange(false); }

  public static startTool(): boolean { return new ProjectGeolocationPointTool().run(); }
}

/** Change or update geolocation direction to true north.
 * @beta
 */
export class ProjectGeolocationNorthTool extends PrimitiveTool {
  public static toolId = "ProjectLocation.Geolocation.North";
  public static iconSpec = "icon-sort-up"; // <== Tool button should use whatever icon you have here...
  protected _origin?: Point3d;
  protected _northDir?: Ray3d;

  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.isSpatialView()); }
  public isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; } // Allow snapping to terrain, etc. outside project extents...
  public requireWriteableTarget(): boolean { return false; } // Tool doesn't modify the imodel...
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }
  public onCleanup() { super.onCleanup(); this.unsuspendDecorations(); }
  public onRestartTool(): void { this.exitTool(); }
  public onUnsuspend(): void { this.provideToolAssistance(); }

  protected provideToolAssistance(): void {
    const acceptMsg = CoreTools.translate("ElementSet.Inputs.AcceptPoint");
    const rejectMsg = CoreTools.translate("ElementSet.Inputs.Cancel");
    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, translatePrompt(undefined === this._origin ? "IdentifyRefPoint" : "DefineAngle"));
    const sections: ToolAssistanceSection[] = [];

    const mouseInstructions: ToolAssistanceInstruction[] = [];
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, acceptMsg, false, ToolAssistanceInputMethod.Mouse));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, rejectMsg, false, ToolAssistanceInputMethod.Mouse));
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));

    const touchInstructions: ToolAssistanceInstruction[] = [];
    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, acceptMsg, false, ToolAssistanceInputMethod.Touch));
    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, rejectMsg, false, ToolAssistanceInputMethod.Touch));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  protected setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    this.provideToolAssistance();

    if (undefined === this._origin)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.setRotation(Matrix3d.createIdentity());
    hints.setOrigin(this._origin);
    hints.setModePolar();
    hints.setOriginFixed = true;
    hints.setLockZ = true;
    hints.sendHints();
  }

  private getAdjustedPoint(ev: BeButtonEvent): Point3d | undefined {
    if (undefined === this._origin)
      return undefined;
    return EditManipulator.HandleUtils.projectPointToPlaneInView(ev.point, this._origin, Vector3d.unitZ(), ev.viewport!, true);
  }

  private unsuspendDecorations() {
    const deco = ProjectExtentsClipDecoration.get();
    if (undefined !== deco)
      deco.suspendGeolocationDecorations = false;
  }

  private updateNorthVector(ev: BeButtonEvent): void {
    if (undefined === ev.viewport)
      return;

    if (undefined === this._northDir)
      this._northDir = Ray3d.create(ev.point, Vector3d.unitY());
    else
      this._northDir.origin.setFrom(undefined !== this._origin ? this._origin : ev.point);

    const dirPt = this.getAdjustedPoint(ev);
    if (undefined === dirPt)
      return;

    this._northDir.direction.setStartEnd(this._northDir.origin, dirPt);
    if (this._northDir.direction.magnitude() < 1.0e-6)
      this._northDir.direction.setFrom(Vector3d.unitY());

    this._northDir.direction.z = 0.0;
    this._northDir.direction.normalizeInPlace();
  }

  public decorate(context: DecorateContext): void {
    if (undefined === this._northDir)
      return;

    const deco = ProjectExtentsClipDecoration.get();
    if (undefined === deco)
      return;

    deco.suspendGeolocationDecorations = true;
    deco.drawNorthArrow(context, this._northDir);
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined === ev.viewport)
      return;

    this.updateNorthVector(ev);
    ev.viewport.invalidateDecorations();
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize(); // Calls onRestartTool to exit...
    return EventHandled.No;
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport)
      return EventHandled.No; // Shouldn't really happen...

    if (undefined === this._origin) {
      this._origin = ev.point.clone();
      this.setupAndPromptForNextAction();
      return EventHandled.No;
    }

    this.updateNorthVector(ev);

    if (undefined !== this._northDir) {
      const deco = ProjectExtentsClipDecoration.get();
      if (undefined !== deco)
        deco.updateNorthDirection(this._northDir);
    }

    this.onReinitialize(); // Calls onRestartTool to exit...
    return EventHandled.No;
  }

  public onInstall(): boolean { return ProjectExtentsClipDecoration.allowEcefLocationChange(true); }

  public static startTool(): boolean { return new ProjectGeolocationNorthTool().run(); }
}
