/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { AccuDrawHintBuilder, AccuDrawShortcuts, AngleDescription, BeButton, BeButtonEvent, CanvasDecoration, CoreTools, DecorateContext, EditManipulator, EventHandled, GraphicType, HitDetail, IModelApp, IModelConnection, LengthDescription, NotifyMessageDetails, OutputMessagePriority, PrimitiveTool, QuantityType, ScreenViewport, ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction, ToolAssistanceSection, Viewport } from "@itwin/core-frontend";
import { Angle, Arc3d, AxisIndex, AxisOrder, Matrix3d, Point3d, Ray3d, Transform, Vector3d, XYAndZ } from "@itwin/core-geometry";
import { Cartographic, ColorDef, EcefLocation, LinePixels } from "@itwin/core-common";
import { clipToProjectExtents, ProjectExtentsClipDecoration, ProjectLocationChanged, translateCoreMeasureBold, translateMessageBold, updateMapDisplay } from "./ProjectExtentsDecoration";
import { DialogItem, DialogProperty, DialogPropertySyncItem } from "@itwin/appui-abstract";
import { EditTools } from "../EditTool";
import { BeEvent } from "@itwin/core-bentley";

// todo: share with ProjectExtentsDecoration...
function translatePrompt(key: string) {
  return EditTools.translate(`ProjectLocation:Prompts.${key}`);
}
function translateMessage(key: string) {
  return EditTools.translate(`ProjectLocation:Message.${key}`);
}

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
  public static override toolId = "ProjectLocation.Geolocation.Point";
  public static override iconSpec = "icon-globe"; // <== Tool button should use whatever icon you have here...

  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 4; } // latitude, longitude, altitude, north direction...

  protected _haveToolSettings = false;
  protected _cartographicFromArgs = false;

  protected _accept = false;
  protected _scale = 1.0;
  protected _origin?: Point3d;
  protected _labelDeco?: LabelDecoration;

  public override isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.isSpatialView()); }
  public override isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; } // Allow snapping to terrain, etc. outside project extents...
  public override requireWriteableTarget(): boolean { return false; } // Tool doesn't modify the imodel...
  public override async onPostInstall() {
    await super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public override async onCleanup() {
    await super.onCleanup();
    this.unsuspendDecorations();
  }

  public async onRestartTool() { return this.exitTool(); }
  public override async onUnsuspend() { this.provideToolAssistance(); }

  private _latitudeProperty: DialogProperty<number> | undefined;
  public get latitudeProperty() {
    if (!this._latitudeProperty)
      this._latitudeProperty = new DialogProperty<number>(new AngleDescription("latitude", translateMessage("Latitude")), 0.0);
    return this._latitudeProperty;
  }

  public get latitude(): number { return this.latitudeProperty.value; }
  public set latitude(value: number) { this.latitudeProperty.value = value; }

  private _longitudeProperty: DialogProperty<number> | undefined;
  public get longitudeProperty() {
    if (!this._longitudeProperty)
      this._longitudeProperty = new DialogProperty<number>(new AngleDescription("longitude", translateMessage("Longitude")), 0.0);
    return this._longitudeProperty;
  }

  public get longitude(): number { return this.longitudeProperty.value; }
  public set longitude(value: number) { this.longitudeProperty.value = value; }

  private _altitudeProperty: DialogProperty<number> | undefined;
  public get altitudeProperty() {
    if (!this._altitudeProperty)
      this._altitudeProperty = new DialogProperty<number>(new LengthDescription("altitude", CoreTools.translate("Measure.Labels.Altitude")), 0.0);
    return this._altitudeProperty;
  }

  public get altitude(): number { return this.altitudeProperty.value; }
  public set altitude(value: number) { this.altitudeProperty.value = value; }

  private _northProperty: DialogProperty<number> | undefined;
  public get northProperty() {
    if (!this._northProperty)
      this._northProperty = new DialogProperty<number>(new AngleDescription("north", translateMessage("North")), 0.0);
    return this._northProperty;
  }

  public get north(): number { return this.northProperty.value; }
  public set north(value: number) { this.northProperty.value = value; }

  private syncToolSettingsCoordinates(): void {
    this.syncToolSettingsProperties([this.latitudeProperty.syncItem, this.longitudeProperty.syncItem, this.altitudeProperty.syncItem, this.northProperty.syncItem]);
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this._haveToolSettings = true;
    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.latitudeProperty.toDialogItem({ rowPriority: 1, columnIndex: 2 }));
    toolSettings.push(this.longitudeProperty.toDialogItem({ rowPriority: 2, columnIndex: 2 }));
    toolSettings.push(this.altitudeProperty.toDialogItem({ rowPriority: 3, columnIndex: 2 }));
    toolSettings.push(this.northProperty.toDialogItem({ rowPriority: 4, columnIndex: 2 }));
    return toolSettings;
  }

  protected provideToolAssistance(): void {
    const acceptMsg = CoreTools.translate(undefined === this._origin ? "ElementSet.Inputs.AcceptPoint" : "ElementSet.Inputs.Accept");
    const rejectMsg = CoreTools.translate("ElementSet.Inputs.Cancel");
    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, translatePrompt(undefined === this._origin ? "IdentifyKnownLocation" : "ConfirmCoordinates"));
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
    IModelApp.accuSnap.enableSnap(undefined === this._origin);
    this.provideToolAssistance();
  }

  private pulseDecoration() {
    if (!this._accept)
      return;

    const deco = ProjectGeolocationMonumentDecoration.get();
    if (undefined === deco)
      return;

    this._scale += 0.1;
    if (this._scale > 1.6)
      this._scale = 1.0;

    deco.viewport.invalidateDecorations();
    setTimeout(() => this.pulseDecoration(), 100);
  }

  private unsuspendDecorations() {
    const deco = ProjectGeolocationMonumentDecoration.get();
    if (undefined !== deco)
      deco.suspendGeolocationDecorations = false;
  }

  public override decorate(context: DecorateContext): void {
    if (undefined === this._origin || !context.viewport.view.isSpatialView())
      return;

    const deco = ProjectGeolocationMonumentDecoration.get();
    if (undefined === deco)
      return;

    deco.suspendGeolocationDecorations = true;
    deco.drawMonumentPoint(context, this._origin, this._scale);

    if (undefined !== this._labelDeco)
      this._labelDeco.addDecoration(context);
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined === ev.viewport || this._accept)
      return;

    this._origin = ev.point.clone();
    ev.viewport.invalidateDecorations();
  }

  public override async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    await this.onReinitialize(); // Calls onRestartTool to exit...
    return EventHandled.No;
  }

  protected acceptDefaultLocation(): void {
    // Greenwich is better default when testing control handle w/o tool settings support...
    this.latitude = Angle.createDegrees(51.4934).radians;
    this.longitude = Angle.createDegrees(0.0098).radians;
    this.altitude = 50.0;
    this.north = 0.0;
  }

  public acceptKnownLocation(ev: BeButtonEvent): void {
    const deco = ProjectGeolocationMonumentDecoration.get();
    if (undefined === deco)
      return;

    this._accept = true; // Require explicit accept to give user a chance to change values...
    this._origin = ev.point.clone();
    this._labelDeco = new LabelDecoration(this._origin, translatePrompt("SpecifyCoordinates"));

    if (!this._cartographicFromArgs) {
      if (this.iModel.isGeoLocated) {
        const cartographic = this.iModel.spatialToCartographicFromEcef(this._origin);
        this.latitude = cartographic.latitude;
        this.longitude = cartographic.longitude;
        this.altitude = cartographic.height;
        this.north = deco.getClockwiseAngleToNorth().radians;
      } else if (!this._haveToolSettings) {
        this.acceptDefaultLocation();
      }
    }

    this.syncToolSettingsCoordinates();
    this.pulseDecoration(); // Pulse to indicate that we are waiting for user input...
    this.setupAndPromptForNextAction();
  }

  public async acceptCoordinates(): Promise<void> {
    const deco = ProjectGeolocationMonumentDecoration.get();
    if (undefined === deco)
      return;

    const origin = Cartographic.fromRadians({ longitude: this.longitude, latitude: this.latitude, height: this.altitude });
    if (!deco.updateEcefLocation(origin, this._origin, Angle.createRadians(this.north)))
      return;

    return this.onReinitialize(); // Calls onRestartTool to exit...
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport)
      return EventHandled.No; // Shouldn't really happen...

    const haveKnownLocation = this._accept;
    if (!haveKnownLocation)
      this.acceptKnownLocation(ev);

    const needAcceptPoint = !haveKnownLocation && this._haveToolSettings;
    if (!needAcceptPoint)
      await this.acceptCoordinates();

    return EventHandled.No;
  }

  public override async onInstall(): Promise<boolean> {
    if (!ProjectGeolocationMonumentDecoration.allowEcefLocationChange(false))
      return false;

    // Setup initial values here instead of supplyToolSettingsProperties to support keyin args w/o appui-react...
    this.initializeToolSettingPropertyValues([this.latitudeProperty, this.longitudeProperty, this.altitudeProperty, this.northProperty]);

    return true;
  }

  /** The keyin takes the following arguments, all of which are optional:
   *  - `latitude=number` Latitude of accept point in degrees.
   *  - `longitude=number` Longitude of accept point in degrees.
   *  - `altitude=number` Height above ellipsoid of accept point.
   *  - `north=number` North direction in degrees of accept point.
   */
  public override async parseAndRun(...inputArgs: string[]): Promise<boolean> {
    for (const arg of inputArgs) {
      const parts = arg.split("=");
      if (2 !== parts.length)
        continue;

      if (parts[0].toLowerCase().startsWith("la")) {
        const latitude = Number.parseFloat(parts[1]);
        if (!Number.isNaN(latitude)) {
          this.saveToolSettingPropertyValue(this.latitudeProperty, { value: Angle.createDegrees(latitude).radians });
          this._cartographicFromArgs = true;
        }
      } else if (parts[0].toLowerCase().startsWith("lo")) {
        const longitude = Number.parseFloat(parts[1]);
        if (!Number.isNaN(longitude)) {
          this.saveToolSettingPropertyValue(this.longitudeProperty, { value: Angle.createDegrees(longitude).radians });
          this._cartographicFromArgs = true;
        }
      } else if (parts[0].toLowerCase().startsWith("al")) {
        const altitude = Number.parseFloat(parts[1]);
        if (!Number.isNaN(altitude)) {
          this.saveToolSettingPropertyValue(this.altitudeProperty, { value: altitude });
          this._cartographicFromArgs = true;
        }
      } else if (parts[0].toLowerCase().startsWith("no")) {
        const north = Number.parseFloat(parts[1]);
        if (!Number.isNaN(north)) {
          this.saveToolSettingPropertyValue(this.northProperty, { value: Angle.createDegrees(north).radians });
          this._cartographicFromArgs = true;
        }
      }
    }

    return this.run();
  }

  public static async startTool(): Promise<boolean> { return new ProjectGeolocationPointTool().run(); }
}

/** Change or update geolocation direction to true north.
 * @beta
 */
export class ProjectGeolocationNorthTool extends PrimitiveTool {
  public static override toolId = "ProjectLocation.Geolocation.North";
  public static override iconSpec = "icon-sort-up"; // <== Tool button should use whatever icon you have here...
  protected _origin?: Point3d;
  protected _northDir?: Ray3d;

  public override isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.isSpatialView()); }
  public override isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; } // Allow snapping to terrain, etc. outside project extents...
  public override requireWriteableTarget(): boolean { return false; } // Tool doesn't modify the imodel...
  public override async onPostInstall() {
    await super.onPostInstall();
    this.setupAndPromptForNextAction();
  }
  public override async onCleanup() {
    await super.onCleanup();
    this.unsuspendDecorations();
  }
  public async onRestartTool() { return this.exitTool(); }
  public override async onUnsuspend() { this.provideToolAssistance(); }

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
    return AccuDrawHintBuilder.projectPointToPlaneInView(ev.point, this._origin, Vector3d.unitZ(), ev.viewport!, true);
  }

  private unsuspendDecorations() {
    const deco = ProjectGeolocationNorthDecoration.get();
    if (undefined !== deco)
      deco.suspendGeolocationDecorations = false;
  }

  private updateNorthVector(ev: BeButtonEvent): void {
    if (undefined === ev.viewport)
      return;

    if (undefined === this._northDir)
      this._northDir = Ray3d.create(ev.point, Vector3d.unitY());
    else
      this._northDir.origin.setFrom(this._origin ?? ev.point);

    const dirPt = this.getAdjustedPoint(ev);
    if (undefined === dirPt)
      return;

    this._northDir.direction.setStartEnd(this._northDir.origin, dirPt);
    if (this._northDir.direction.magnitude() < 1.0e-6)
      this._northDir.direction.setFrom(Vector3d.unitY());

    this._northDir.direction.z = 0.0;
    this._northDir.direction.normalizeInPlace();
  }

  public override decorate(context: DecorateContext): void {
    if (undefined === this._northDir || !context.viewport.view.isSpatialView())
      return;

    const deco = ProjectGeolocationNorthDecoration.get();
    if (undefined === deco)
      return;

    deco.suspendGeolocationDecorations = true;
    deco.drawNorthArrow(context, this._northDir);
  }

  public override async onKeyTransition(wentDown: boolean, keyEvent: KeyboardEvent): Promise<EventHandled> {
    if (EventHandled.Yes === await super.onKeyTransition(wentDown, keyEvent))
      return EventHandled.Yes;
    return (wentDown && await AccuDrawShortcuts.processShortcutKey(keyEvent)) ? EventHandled.Yes : EventHandled.No;
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined === ev.viewport)
      return;

    this.updateNorthVector(ev);
    ev.viewport.invalidateDecorations();
  }

  public override async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    await this.onReinitialize(); // Calls onRestartTool to exit...
    return EventHandled.No;
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport)
      return EventHandled.No; // Shouldn't really happen...

    if (undefined === this._origin) {
      this._origin = ev.point.clone();
      this.setupAndPromptForNextAction();
      return EventHandled.No;
    }

    this.updateNorthVector(ev);

    if (undefined !== this._northDir) {
      const deco = ProjectGeolocationNorthDecoration.get();
      if (undefined !== deco)
        deco.updateNorthDirection(this._northDir);
    }

    await this.onReinitialize(); // Calls onRestartTool to exit...
    return EventHandled.No;
  }

  public override async onInstall(): Promise<boolean> { return ProjectGeolocationNorthDecoration.allowEcefLocationChange(true); }

  public static async startTool() { return new ProjectGeolocationNorthTool().run(); }
}

/** Move a geolocated model by specifying two points to define the offset.
 * @beta
 */
export class ProjectGeolocationMoveTool extends PrimitiveTool {
  public static override toolId = "ProjectLocation.Geolocation.Move";
  public static override iconSpec = "icon-move"; // <== Tool button should use whatever icon you have here...
  protected _origin?: Point3d;
  protected _current?: Point3d;

  public override isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.isSpatialView()); }
  public override isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; } // Allow snapping to terrain, etc. outside project extents...
  public override requireWriteableTarget(): boolean { return false; } // Tool doesn't modify the imodel...
  public override async onPostInstall() {
    await super.onPostInstall();
    this.setupAndPromptForNextAction();
  }
  public override async onCleanup() {
    await super.onCleanup();
    this.unsuspendDecorations();
  }
  public async onRestartTool() {
    const tool = new ProjectGeolocationMoveTool();
    if (!await tool.run())
      return this.exitTool();
  }

  public override async onUnsuspend() { this.provideToolAssistance(); }

  protected provideToolAssistance(): void {
    const acceptMsg = CoreTools.translate("ElementSet.Inputs.AcceptPoint");
    const rejectMsg = CoreTools.translate("ElementSet.Inputs.Cancel");
    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, translatePrompt(undefined === this._origin ? "IdentifyRefPoint" : "DefineOffset"));
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
    hints.sendHints();
  }

  private unsuspendDecorations() {
    const deco = ProjectExtentsClipDecoration.get();
    if (undefined !== deco)
      deco.suspendGeolocationDecorations = false;
  }

  private async acceptOffset(ev: BeButtonEvent): Promise<void> {
    if (undefined === ev.viewport || undefined === this._origin)
      return;

    const deco = ProjectExtentsClipDecoration.get();
    if (undefined === deco)
      return;

    const origin = this.iModel.spatialToCartographicFromEcef(ev.point);
    if (!deco.updateEcefLocation(origin, this._origin))
      return;

    return this.onReinitialize(); // Calls onRestartTool to exit...
  }

  public override decorate(context: DecorateContext): void {
    if (undefined === this._origin || undefined === this._current || !context.viewport.view.isSpatialView())
      return;

    const deco = ProjectExtentsClipDecoration.get();
    if (undefined === deco)
      return;

    const builderAccVis = context.createGraphicBuilder(GraphicType.WorldDecoration);
    const builderAccHid = context.createGraphicBuilder(GraphicType.WorldOverlay);
    const colorAccVis = ColorDef.white.adjustedForContrast(context.viewport.view.backgroundColor);
    const colorAccHid = colorAccVis.withAlpha(100);

    builderAccVis.setSymbology(colorAccVis, ColorDef.black, 3);
    builderAccHid.setSymbology(colorAccHid, ColorDef.black, 1, LinePixels.Code2);

    const extents = this.iModel.projectExtents.cloneTranslated(Vector3d.createStartEnd(this._origin, this._current));

    builderAccVis.addRangeBox(extents);
    builderAccHid.addRangeBox(extents);
    builderAccHid.addLineString([this._origin, this._current]);

    context.addDecorationFromBuilder(builderAccVis);
    context.addDecorationFromBuilder(builderAccHid);

    deco.suspendGeolocationDecorations = true;
  }

  public override async onKeyTransition(wentDown: boolean, keyEvent: KeyboardEvent): Promise<EventHandled> {
    if (EventHandled.Yes === await super.onKeyTransition(wentDown, keyEvent))
      return EventHandled.Yes;
    return (wentDown && await AccuDrawShortcuts.processShortcutKey(keyEvent)) ? EventHandled.Yes : EventHandled.No;
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined === ev.viewport)
      return;

    this._current = ev.point;
    ev.viewport.invalidateDecorations();
  }

  public override async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this._origin)
      await this.exitTool(); // exit to select tool if we haven't gotten first point...
    else
      await this.onReinitialize(); // Calls onRestartTool...
    return EventHandled.No;
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport)
      return EventHandled.No; // Shouldn't really happen...

    if (undefined === this._origin) {
      this._origin = ev.point.clone();
      this.setupAndPromptForNextAction();
      return EventHandled.No;
    }

    await this.acceptOffset(ev);
    return EventHandled.No;
  }

  public override async onInstall(): Promise<boolean> { return ProjectExtentsClipDecoration.allowEcefLocationChange(true); }

  public static async startTool() { return new ProjectGeolocationMoveTool().run(); }
}

class ProjectGeolocationMonumentDecoration extends EditManipulator.HandleProvider {
  private static _decorator?: ProjectGeolocationMonumentDecoration;
  protected _ecefLocation?: EcefLocation;
  protected _allowEcefLocationChange = false;
  protected _monumentPoint?: Point3d;
  protected _monumentId?: string;
  protected _removeViewCloseListener?: () => void;
  public suspendGeolocationDecorations = false;

  /** Called when project extents or geolocation is modified */
  public readonly onChanged = new BeEvent<(iModel: IModelConnection, ev: ProjectLocationChanged) => void>();

  public constructor(public viewport: ScreenViewport) {
    super(viewport.iModel);

    if (!this.init())
      return;

    this._monumentId = this.iModel.transientIds.getNext();
    this.start();
  }

  protected start(): void {
    this.updateDecorationListener(true);
    this._removeViewCloseListener = IModelApp.viewManager.onViewClose.addListener((vp) => this.onViewClose(vp));
  }

  protected override stop(): void {
    super.stop();
    this._removeViewCloseListener?.();
    this._removeViewCloseListener = undefined;
  }

  protected init(): boolean {
    this._ecefLocation = this.iModel.ecefLocation;
    this._monumentPoint = this.getMonumentPoint();

    return true;
  }

  public onViewClose(vp: ScreenViewport): void {
    if (this.viewport === vp)
      ProjectGeolocationMonumentDecoration.clear();
  }

  protected hasValidGCS(): boolean {
    if (!this.iModel.isGeoLocated || this.iModel.noGcsDefined)
      return false;

    const gcs = this.iModel.geographicCoordinateSystem;
    if (undefined === gcs || undefined === gcs.horizontalCRS)
      return false; // A valid GCS ought to have horizontalCR defined...

    // Check for approximate GCS (such as from MicroStation's "From Placemark" tool) and allow it to be replaced...
    const hasValidId = (undefined !== gcs.horizontalCRS.id && 0 !== gcs.horizontalCRS.id.length);
    const hasValidDescr = (undefined !== gcs.horizontalCRS.description && 0 !== gcs.horizontalCRS.description.length);
    const hasValidProjection = (undefined !== gcs.horizontalCRS.projection && "AzimuthalEqualArea" !== gcs.horizontalCRS.projection.method);

    return hasValidId || hasValidDescr || hasValidProjection;
  }

  protected override async onRightClick(_hit: HitDetail, _ev: BeButtonEvent): Promise<EventHandled> { return EventHandled.No; }

  public override async onDecorationButtonEvent(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> {
    if (hit.sourceId === this._monumentId) {
      if (BeButton.Data === ev.button && !ev.isDown && !ev.isDragging)
        await ProjectGeolocationPointTool.startTool();
      return EventHandled.Yes; // Only pickable for tooltip, don't allow selection...
    }

    return super.onDecorationButtonEvent(hit, ev);
  }

  public async getDecorationToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    const quantityFormatter = IModelApp.quantityFormatter;
    const toolTip = document.createElement("div");
    let toolTipHtml = "";

    if (hit.sourceId === this._monumentId) {
      toolTipHtml += `${translateMessage("ModifyGeolocation")}<br>`;

      const coordFormatterSpec = quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Coordinate);
      if (undefined !== coordFormatterSpec) {
        const pointAdjusted = this._monumentPoint!.minus(this.iModel.globalOrigin);
        const formattedPointX = quantityFormatter.formatQuantity(pointAdjusted.x, coordFormatterSpec);
        const formattedPointY = quantityFormatter.formatQuantity(pointAdjusted.y, coordFormatterSpec);
        const formattedPointZ = quantityFormatter.formatQuantity(pointAdjusted.z, coordFormatterSpec);
        toolTipHtml += `${translateCoreMeasureBold("Coordinate") + formattedPointX}, ${formattedPointY}, ${formattedPointZ}<br>`;
      }

      const latLongFormatterSpec = quantityFormatter.findFormatterSpecByQuantityType(QuantityType.LatLong);
      if (undefined !== latLongFormatterSpec && undefined !== coordFormatterSpec && this.iModel.isGeoLocated) {
        const cartographic = this.iModel.spatialToCartographicFromEcef(this._monumentPoint!);
        const formattedLat = quantityFormatter.formatQuantity(Math.abs(cartographic.latitude), latLongFormatterSpec);
        const formattedLong = quantityFormatter.formatQuantity(Math.abs(cartographic.longitude), latLongFormatterSpec);
        const formattedHeight = quantityFormatter.formatQuantity(cartographic.height, coordFormatterSpec);
        const latDir = CoreTools.translate(cartographic.latitude < 0 ? "Measure.Labels.S" : "Measure.Labels.N");
        const longDir = CoreTools.translate(cartographic.longitude < 0 ? "Measure.Labels.W" : "Measure.Labels.E");
        toolTipHtml += `${translateCoreMeasureBold("LatLong") + formattedLat + latDir}, ${formattedLong}${longDir}<br>`;
        toolTipHtml += `${translateCoreMeasureBold("Altitude") + formattedHeight}<br>`;
      }
    }

    toolTip.innerHTML = toolTipHtml;
    return toolTip;
  }

  public testDecorationHit(id: string): boolean { return (id === this._monumentId); }

  public getMonumentPoint(): Point3d {
    if (this.iModel.ecefLocation?.cartographicOrigin)
      return this.iModel.cartographicToSpatialFromEcef(this.iModel.ecefLocation.cartographicOrigin);

    const extents = this.iModel.projectExtents;
    return Point3d.create(extents.low.x, extents.low.y, 0 > extents.low.z && 0 < extents.high.z ? 0 : extents.low.z);
  }

  public drawMonumentPoint(context: DecorateContext, point: Point3d, scaleFactor: number, id?: string): void {
    const vp = context.viewport;
    const pixelSize = vp.pixelsFromInches(0.25) * scaleFactor;
    const scale = vp.viewingSpace.getPixelSizeAtPoint(point) * pixelSize;
    const matrix = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createDegrees(45));

    matrix.scaleColumnsInPlace(scale, scale, scale);
    const monumentTrans = Transform.createRefs(point, matrix);

    const monumentPointBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay, monumentTrans, id);
    const color = ColorDef.white;

    monumentPointBuilder.setSymbology(color, ColorDef.from(0, 0, 0, 150), 1);
    monumentPointBuilder.addArc(Arc3d.createXY(Point3d.createZero(), 0.7), true, true);

    monumentPointBuilder.setSymbology(color, color, 2);
    monumentPointBuilder.addArc(Arc3d.createXY(Point3d.createZero(), 0.5), false, false);
    monumentPointBuilder.addLineString([Point3d.create(0.5, 0), Point3d.create(-0.5, 0)]);
    monumentPointBuilder.addLineString([Point3d.create(0, 0.5), Point3d.create(0, -0.5)]);

    context.addDecorationFromBuilder(monumentPointBuilder);
  }

  public override decorate(context: DecorateContext): void {
    if (!this.suspendGeolocationDecorations && this._monumentId && this._monumentPoint && this._allowEcefLocationChange && this.viewport === context.viewport)
      this.drawMonumentPoint(context, this._monumentPoint, 1, this._monumentId);
  }

  public resetGeolocation(): boolean {
    if (!this._allowEcefLocationChange)
      return false;

    if (!this.getModifiedEcefLocation())
      return false; // Wasn't changed...

    this.iModel.disableGCS(false);
    this.iModel.ecefLocation = this._ecefLocation;

    this._monumentPoint = this.getMonumentPoint();

    updateMapDisplay(this.viewport, false);
    this.onChanged.raiseEvent(this.iModel, ProjectLocationChanged.ResetGeolocation);
    return true;
  }

  public getClockwiseAngleToNorth(): Angle {
    const angle = this.getNorthAngle();
    angle.setRadians(Angle.adjustRadians0To2Pi(angle.radians));
    return angle;
  }

  private getNorthAngle(): Angle {
    const northDirection = this.getNorthDirection();
    return northDirection.direction.angleToXY(Vector3d.unitY());
  }

  private getNorthDirection(): Ray3d {
    const origin = this.iModel.projectExtents.center;
    if (!this.iModel.isGeoLocated)
      return Ray3d.create(origin, Vector3d.unitY());

    const cartographic = this.iModel.spatialToCartographicFromEcef(origin);
    cartographic.latitude += Angle.createDegrees(0.01).radians;
    const pt2 = this.iModel.cartographicToSpatialFromEcef(cartographic);
    const northVec = Vector3d.createStartEnd(origin, pt2);
    northVec.z = 0;
    northVec.normalizeInPlace();

    return Ray3d.create(origin, northVec);
  }

  public updateEcefLocation(origin: Cartographic, point: Point3d | undefined, angle: Angle | undefined): boolean {
    if (!this._allowEcefLocationChange)
      return false;

    const newEcefLocation = EcefLocation.createFromCartographicOrigin(origin, point, angle ?? this.getNorthAngle());
    const ecefLocation = this.iModel.ecefLocation;
    if (undefined !== ecefLocation && ecefLocation.isAlmostEqual(newEcefLocation))
      return false;

    this.iModel.disableGCS(true); // Map display will ignore change to ecef location when GCS is present...
    this.iModel.setEcefLocation(newEcefLocation);

    this._monumentPoint = this.getMonumentPoint();

    updateMapDisplay(this.viewport, true);
    this.onChanged.raiseEvent(this.iModel, ProjectLocationChanged.Geolocation);
    return true;
  }

  public getModifiedEcefLocation(): EcefLocation | undefined {
    const ecefLocation = this.iModel.ecefLocation;
    if (undefined === ecefLocation)
      return undefined; // geolocation wasn't added...

    if (undefined === this._ecefLocation)
      return ecefLocation; // geolocation didn't exist previously...

    if (this._ecefLocation.isAlmostEqual(ecefLocation))
      return undefined;

    return ecefLocation;
  }

  protected override async createControls(): Promise<boolean> {
    this._allowEcefLocationChange = !this.hasValidGCS();
    return false;
  }

  protected override async modifyControls(_hit: HitDetail, _ev: BeButtonEvent): Promise<boolean> {
    return false;
  }

  public static allowEcefLocationChange(requireExisting: boolean, outputError = true) {
    let errMessage: string | undefined;
    // todo: verify/add messages as needed
    if (undefined === ProjectGeolocationMonumentDecoration._decorator) {
      errMessage = "NotActive";
    } else if (!ProjectGeolocationMonumentDecoration._decorator._allowEcefLocationChange) {
      errMessage = "NotAllowed";
    } else if (requireExisting && !ProjectGeolocationMonumentDecoration._decorator.iModel.isGeoLocated) {
      errMessage = "NotGeolocated";
    }
    if (errMessage) {
      if (outputError)
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, translateMessage(errMessage)));
      return false;
    }
    return true;
  }

  public static get() {
    return ProjectGeolocationMonumentDecoration._decorator;
  }

  public static show(vp: ScreenViewport): boolean {
    if (!vp.view.isSpatialView())
      return false;

    if (undefined !== ProjectGeolocationMonumentDecoration._decorator) {
      const deco = ProjectGeolocationMonumentDecoration._decorator;
      if (vp === deco.viewport && deco._monumentId && deco._monumentPoint) {
        if (undefined === deco._removeManipulatorToolListener) {
          deco._removeManipulatorToolListener = IModelApp.toolAdmin.manipulatorToolEvent.addListener((tool, event) => deco.onManipulatorToolEvent(tool, event));
          deco.start();
          // todo: new/different event here?
          deco.onChanged.raiseEvent(deco.iModel, ProjectLocationChanged.Show);
        }
        return true;
      }
      ProjectGeolocationMonumentDecoration.clear();
    }

    if (!clipToProjectExtents(vp))
      return false;

    ProjectGeolocationMonumentDecoration._decorator = new ProjectGeolocationMonumentDecoration(vp);
    vp.onChangeView.addOnce(() => ProjectGeolocationMonumentDecoration.clear(true));
    return !!ProjectGeolocationMonumentDecoration._decorator._monumentId;
  }

  public static hide(): void {
    if (!ProjectGeolocationMonumentDecoration._decorator)
      return;
    const saveId = ProjectGeolocationMonumentDecoration._decorator._monumentId; // cleared by stop to trigger decorator removal...
    ProjectGeolocationMonumentDecoration._decorator.stop();
    ProjectGeolocationMonumentDecoration._decorator._monumentId = saveId;
    ProjectGeolocationMonumentDecoration._decorator.onChanged.raiseEvent(ProjectGeolocationMonumentDecoration._decorator.iModel, ProjectLocationChanged.Hide);
  }

  public static clear(resetGeolocation: boolean = true): void {
    if (undefined === ProjectGeolocationMonumentDecoration._decorator)
      return;
    if (resetGeolocation)
      ProjectGeolocationMonumentDecoration._decorator.resetGeolocation(); // Restore modified geolocation back to create state...
    ProjectGeolocationMonumentDecoration._decorator.stop();
    ProjectGeolocationMonumentDecoration._decorator = undefined;
  }

  public static async update(): Promise<void> {
    const deco = ProjectGeolocationMonumentDecoration._decorator;
    if (undefined === deco)
      return;

    deco.init();
    return deco.updateControls();
  }
}

export class ProjectGeolocationNorthDecoration extends EditManipulator.HandleProvider {
  private static _decorator?: ProjectGeolocationNorthDecoration;
  protected _allowEcefLocationChange = false;
  protected _northDirection?: Ray3d;
  protected _northId?: string;
  protected _removeViewCloseListener?: () => void;
  public suspendGeolocationDecorations = false;

  /** Called when project extents or geolocation is modified */
  public readonly onChanged = new BeEvent<(iModel: IModelConnection, ev: ProjectLocationChanged) => void>();

  public constructor(public viewport: ScreenViewport) {
    super(viewport.iModel);

    if (!this.init())
      return;

    this._northId = this.iModel.transientIds.getNext();
    this.start();
  }

  protected start(): void {
    this.updateDecorationListener(true);
    this._removeViewCloseListener = IModelApp.viewManager.onViewClose.addListener((vp) => this.onViewClose(vp));
  }

  protected override stop(): void {
    this._northId = undefined; // Invalidate id so that decorator will be dropped...
    super.stop();
    if (undefined !== this._removeViewCloseListener) {
      this._removeViewCloseListener();
      this._removeViewCloseListener = undefined;
    }
  }

  protected init(): boolean {
    this._northDirection = this.getNorthDirection();
    return true;
  }

  public onViewClose(vp: ScreenViewport): void {
    if (this.viewport === vp)
      ProjectGeolocationNorthDecoration.clear();
  }

  protected hasValidGCS(): boolean {
    if (!this.iModel.isGeoLocated || this.iModel.noGcsDefined)
      return false;

    const gcs = this.iModel.geographicCoordinateSystem;
    if (undefined === gcs || undefined === gcs.horizontalCRS)
      return false; // A valid GCS ought to have horizontalCR defined...

    // Check for approximate GCS (such as from MicroStation's "From Placemark" tool) and allow it to be replaced...
    const hasValidId = (undefined !== gcs.horizontalCRS.id && 0 !== gcs.horizontalCRS.id.length);
    const hasValidDescr = (undefined !== gcs.horizontalCRS.description && 0 !== gcs.horizontalCRS.description.length);
    const hasValidProjection = (undefined !== gcs.horizontalCRS.projection && "AzimuthalEqualArea" !== gcs.horizontalCRS.projection.method);

    return hasValidId || hasValidDescr || hasValidProjection;
  }

  protected override async createControls(): Promise<boolean> {
    if (undefined === this._northId)
      return false;

    this._allowEcefLocationChange = !this.hasValidGCS();
    return false;
  }

  protected override async modifyControls(_hit: HitDetail, _ev: BeButtonEvent): Promise<boolean> {
    return false;
  }

  protected override async onRightClick(_hit: HitDetail, _ev: BeButtonEvent): Promise<EventHandled> { return EventHandled.No; }

  protected override async onTouchTap(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> { return (hit.sourceId === this._northId ? EventHandled.No : super.onTouchTap(hit, ev)); }

  public override async onDecorationButtonEvent(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> {
    if (hit.sourceId === this._northId) {
      if (BeButton.Data === ev.button && !ev.isDown && !ev.isDragging)
        await ProjectGeolocationNorthTool.startTool();
      return EventHandled.Yes; // Only pickable for tooltip, don't allow selection...
    }

    return super.onDecorationButtonEvent(hit, ev);
  }

  // todo: do we need this? Don't think so, but will leave for now
  public override onManipulatorEvent(eventType: EditManipulator.EventType): void {
    if (EditManipulator.EventType.Accept === eventType)
      this.onChanged.raiseEvent(this.iModel, ProjectLocationChanged.Extents);
    super.onManipulatorEvent(eventType);
  }

  public async getDecorationToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    const quantityFormatter = IModelApp.quantityFormatter;
    const toolTip = document.createElement("div");
    let toolTipHtml = "";

    if (hit.sourceId === this._northId) {
      toolTipHtml += `${translateMessage("ModifyNorthDirection")}<br>`;

      const angleFormatterSpec = quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Angle);
      if (undefined !== angleFormatterSpec) {
        const formattedAngle = quantityFormatter.formatQuantity(this.getClockwiseAngleToNorth().radians, angleFormatterSpec);
        toolTipHtml += `${translateMessageBold("Angle") + formattedAngle}<br>`;
      }
    }

    toolTip.innerHTML = toolTipHtml;
    return toolTip;
  }

  public testDecorationHit(id: string): boolean { return (id === this._northId || id === this._northId || id === this._northId); }
  protected override updateDecorationListener(_add: boolean): void { super.updateDecorationListener(undefined !== this._northId); } // Decorator isn't just for resize controls...

  public getMonumentPoint(): Point3d {
    const origin = Point3d.createZero();
    if (this.iModel.ecefLocation && this.iModel.ecefLocation.cartographicOrigin)
      return this.iModel.cartographicToSpatialFromEcef(this.iModel.ecefLocation.cartographicOrigin, origin);
    origin.setFrom(this.iModel.projectExtents.low);
    if (0.0 > this.iModel.projectExtents.low.z && 0.0 < this.iModel.projectExtents.high.z)
      origin.z = 0.0;
    return origin;
  }

  public getClockwiseAngleToNorth(): Angle {
    const angle = this.getNorthAngle();
    angle.setRadians(Angle.adjustRadians0To2Pi(angle.radians));
    return angle;
  }

  public getNorthAngle(): Angle {
    const northDirection = (undefined !== this._northDirection ? this._northDirection : this.getNorthDirection());
    return northDirection.direction.angleToXY(Vector3d.unitY());
  }

  public getNorthDirection(refOrigin?: Point3d): Ray3d {
    const origin = (undefined !== refOrigin ? refOrigin : this.iModel.projectExtents.center);

    if (!this.iModel.isGeoLocated)
      return Ray3d.create(origin, Vector3d.unitY());

    const cartographic = this.iModel.spatialToCartographicFromEcef(origin);
    cartographic.latitude += Angle.createDegrees(0.01).radians;
    const pt2 = this.iModel.cartographicToSpatialFromEcef(cartographic);
    const northVec = Vector3d.createStartEnd(origin, pt2);
    northVec.z = 0.0;
    northVec.normalizeInPlace();

    return Ray3d.create(origin, northVec);
  }

  public drawNorthArrow(context: DecorateContext, northDir: Ray3d, id?: string): void {
    const vp = context.viewport;
    const pixelSize = vp.pixelsFromInches(0.55);
    const scale = vp.viewingSpace.getPixelSizeAtPoint(northDir.origin) * pixelSize;
    const matrix = Matrix3d.createRigidFromColumns(northDir.direction, Vector3d.unitZ(), AxisOrder.YZX);

    if (undefined === matrix)
      return;

    matrix.scaleColumnsInPlace(scale, scale, scale);
    const arrowTrans = Transform.createRefs(northDir.origin, matrix);

    const northArrowBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay, arrowTrans, id);
    const color = ColorDef.white;

    const arrowOutline: Point3d[] = [];
    arrowOutline[0] = Point3d.create(0.0, 0.65);
    arrowOutline[1] = Point3d.create(-0.45, -0.5);
    arrowOutline[2] = Point3d.create(0.0, -0.2);
    arrowOutline[3] = Point3d.create(0.45, -0.5);
    arrowOutline[4] = arrowOutline[0].clone();

    const arrowLeftFill: Point3d[] = [];
    arrowLeftFill[0] = arrowOutline[0].clone();
    arrowLeftFill[1] = arrowOutline[1].clone();
    arrowLeftFill[2] = arrowOutline[2].clone();
    arrowLeftFill[3] = arrowLeftFill[0].clone();

    const arrowRightFill: Point3d[] = [];
    arrowRightFill[0] = arrowOutline[0].clone();
    arrowRightFill[1] = arrowOutline[3].clone();
    arrowRightFill[2] = arrowOutline[2].clone();
    arrowRightFill[3] = arrowRightFill[0].clone();

    northArrowBuilder.setSymbology(color, ColorDef.from(0, 0, 0, 200), 1);
    northArrowBuilder.addArc(Arc3d.createXY(Point3d.createZero(), 0.6), true, true);
    northArrowBuilder.addArc(Arc3d.createXY(Point3d.create(0.0, 0.85), 0.2), true, true);

    northArrowBuilder.setSymbology(color, color, 2);
    northArrowBuilder.addArc(Arc3d.createXY(Point3d.createZero(), 0.5), false, false);
    northArrowBuilder.addLineString([Point3d.create(0.6, 0.0), Point3d.create(-0.6, 0.0)]);
    northArrowBuilder.addLineString([Point3d.create(0.0, 0.6), Point3d.create(0.0, -0.6)]);

    northArrowBuilder.setSymbology(color, ColorDef.from(150, 150, 150), 1);
    northArrowBuilder.addShape(arrowLeftFill);

    northArrowBuilder.setSymbology(color, ColorDef.black, 1);
    northArrowBuilder.addShape(arrowRightFill);

    northArrowBuilder.setSymbology(color, color, 1);
    northArrowBuilder.addLineString(arrowOutline);
    northArrowBuilder.setSymbology(color, color, 3);
    northArrowBuilder.addLineString([Point3d.create(-0.1, 0.75), Point3d.create(-0.1, 0.95), Point3d.create(0.1, 0.75), Point3d.create(0.1, 0.95)]);

    context.addDecorationFromBuilder(northArrowBuilder);
  }

  public override decorate(context: DecorateContext): void {
    if (undefined === this._northId)
      return;

    if (this.viewport !== context.viewport)
      return;

    if (!this.suspendGeolocationDecorations && this._northDirection && this.iModel.isGeoLocated)
      this.drawNorthArrow(context, this._northDirection, this._allowEcefLocationChange ? this._northId : undefined); // Show north, but don't make pickable if it shouldn't be modified...
  }

  public resetGeolocation(): boolean {
    if (!this._allowEcefLocationChange)
      return false;

    // if (undefined === this.getModifiedEcefLocation())
    //   return false; // Wasn't changed...

    this.iModel.disableGCS(false);
    this._northDirection = this.getNorthDirection();

    updateMapDisplay(this.viewport, false);
    this.onChanged.raiseEvent(this.iModel, ProjectLocationChanged.ResetGeolocation);
    return true;
  }

  public updateEcefLocation(origin: Cartographic, point?: Point3d, angle?: Angle): boolean {
    if (!this._allowEcefLocationChange)
      return false;

    const newEcefLocation = EcefLocation.createFromCartographicOrigin(origin, point, angle ?? this.getNorthAngle()); // Preserve modified north direction...
    const ecefLocation = this.iModel.ecefLocation;
    if (undefined !== ecefLocation && ecefLocation.isAlmostEqual(newEcefLocation))
      return false;

    this.iModel.disableGCS(true); // Map display will ignore change to ecef location when GCS is present...
    this.iModel.setEcefLocation(newEcefLocation);

    this._northDirection = this.getNorthDirection(undefined !== this._northDirection ? this._northDirection.origin : undefined); // Preserve modified north reference point...

    updateMapDisplay(this.viewport, true);
    this.onChanged.raiseEvent(this.iModel, ProjectLocationChanged.Geolocation);
    return true;
  }

  public updateNorthDirection(northDir: Ray3d): boolean {
    if (!this._allowEcefLocationChange || !this.iModel.isGeoLocated)
      return false;

    const point = this.getMonumentPoint();
    const origin = this.iModel.spatialToCartographicFromEcef(point);

    const saveDirection = this._northDirection;
    this._northDirection = northDir; // Change reference point to input location...
    const angle = this.getNorthAngle();

    if (!this.updateEcefLocation(origin, point, angle)) {
      this._northDirection = saveDirection;
      return false;
    }

    return true;
  }

  public static allowEcefLocationChange(requireExisting: boolean, outputError: boolean = true): boolean {
    if (undefined === ProjectGeolocationNorthDecoration._decorator) {
      if (outputError)
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, translateMessage("NotActive")));
      return false;
    } else if (!ProjectGeolocationNorthDecoration._decorator._allowEcefLocationChange) {
      if (outputError)
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, translateMessage("NotAllowed")));
      return false;
    } else if (requireExisting && !ProjectGeolocationNorthDecoration._decorator.iModel.isGeoLocated) {
      if (outputError)
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, translateMessage("NotGeolocated")));
      return false;
    }
    return true;
  }

  public static get() {
    return ProjectGeolocationNorthDecoration._decorator;
  }

  public static show(vp: ScreenViewport): boolean {
    if (!vp.view.isSpatialView())
      return false;

    if (undefined !== ProjectGeolocationNorthDecoration._decorator) {
      const deco = ProjectGeolocationNorthDecoration._decorator;
      if (vp === deco.viewport && undefined !== deco._northId && undefined !== deco._northDirection) {
        if (undefined === deco._removeManipulatorToolListener) {
          deco._removeManipulatorToolListener = IModelApp.toolAdmin.manipulatorToolEvent.addListener((tool, event) => deco.onManipulatorToolEvent(tool, event));
          deco.start();
          deco.onChanged.raiseEvent(deco.iModel, ProjectLocationChanged.Show);
        }
        return true;
      }
      ProjectGeolocationNorthDecoration.clear();
    }

    if (!clipToProjectExtents(vp))
      return false;

    ProjectGeolocationNorthDecoration._decorator = new ProjectGeolocationNorthDecoration(vp);
    vp.onChangeView.addOnce(() => this.clear(true));
    return (undefined !== ProjectGeolocationNorthDecoration._decorator._northId);
  }

  public static hide(): void {
    if (undefined === ProjectGeolocationNorthDecoration._decorator)
      return;
    const saveId = ProjectGeolocationNorthDecoration._decorator._northId; // cleared by stop to trigger decorator removal...
    ProjectGeolocationNorthDecoration._decorator.stop();
    ProjectGeolocationNorthDecoration._decorator._northId = saveId;
    ProjectGeolocationNorthDecoration._decorator.onChanged.raiseEvent(ProjectGeolocationNorthDecoration._decorator.iModel, ProjectLocationChanged.Hide);
  }

  public static clear(resetGeolocation: boolean = true): void {
    if (undefined === ProjectGeolocationNorthDecoration._decorator)
      return;
    if (resetGeolocation)
      ProjectGeolocationNorthDecoration._decorator.resetGeolocation(); // Restore modified geolocation back to create state...
    ProjectGeolocationNorthDecoration._decorator.stop();
    ProjectGeolocationNorthDecoration._decorator = undefined;
  }

  public static async update(): Promise<void> {
    const deco = ProjectGeolocationNorthDecoration._decorator;
    if (undefined === deco)
      return;

    clipToProjectExtents(deco.viewport);
    deco.init();

    return deco.updateControls();
  }
}
