/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { AccuDrawHintBuilder, AngleDescription, BeButtonEvent, CanvasDecoration, CoreTools, DecorateContext, EventHandled, GraphicType, IModelApp, LengthDescription, PrimitiveTool, ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction, ToolAssistanceSection, Viewport } from "@itwin/core-frontend";
import { Angle, Matrix3d, Point3d, Ray3d, Vector3d, XYAndZ } from "@itwin/core-geometry";
import { Cartographic, ColorDef, LinePixels } from "@itwin/core-common";
import { ProjectExtentsClipDecoration } from "./ProjectExtentsDecoration";
import { DialogItem, DialogProperty, DialogPropertySyncItem } from "@itwin/appui-abstract";
import { EditTools } from "../EditTool";

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

    const deco = ProjectExtentsClipDecoration.get();
    if (undefined === deco)
      return;

    this._scale += 0.1;
    if (this._scale > 1.6)
      this._scale = 1.0;

    deco.viewport.invalidateDecorations();
    setTimeout(() => this.pulseDecoration(), 100);
  }

  private unsuspendDecorations() {
    const deco = ProjectExtentsClipDecoration.get();
    if (undefined !== deco)
      deco.suspendGeolocationDecorations = false;
  }

  public override decorate(context: DecorateContext): void {
    if (undefined === this._origin || !context.viewport.view.isSpatialView())
      return;

    const deco = ProjectExtentsClipDecoration.get();
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
    const deco = ProjectExtentsClipDecoration.get();
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
    const deco = ProjectExtentsClipDecoration.get();
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
    if (!ProjectExtentsClipDecoration.allowEcefLocationChange(false))
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
    hints.setMatrix(Matrix3d.createIdentity());
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

  public override decorate(context: DecorateContext): void {
    if (undefined === this._northDir || !context.viewport.view.isSpatialView())
      return;

    const deco = ProjectExtentsClipDecoration.get();
    if (undefined === deco)
      return;

    deco.suspendGeolocationDecorations = true;
    deco.drawNorthArrow(context, this._northDir);
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
      const deco = ProjectExtentsClipDecoration.get();
      if (undefined !== deco)
        deco.updateNorthDirection(this._northDir);
    }

    await this.onReinitialize(); // Calls onRestartTool to exit...
    return EventHandled.No;
  }

  public override async onInstall(): Promise<boolean> { return ProjectExtentsClipDecoration.allowEcefLocationChange(true); }

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
    hints.setMatrix(Matrix3d.createIdentity());
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

