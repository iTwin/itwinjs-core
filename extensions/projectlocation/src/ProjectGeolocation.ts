/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, PrimitiveTool, BeButtonEvent, EventHandled, Viewport, EditManipulator, AccuDrawHintBuilder, DecorateContext } from "@bentley/imodeljs-frontend";
import { Point3d, Vector3d, Matrix3d, Ray3d, Angle } from "@bentley/geometry-core";
import { Cartographic } from "@bentley/imodeljs-common";
import { ProjectExtentsClipDecoration } from "./ProjectExtentsDecoration";

/** Change or update geolocation for project.
 * @beta
 */
export class ProjectGeolocationPointTool extends PrimitiveTool {
  public static toolId = "ProjectLocation.Geolocation.Point";
  public static iconSpec = "icon-globe"; // <== Tool button should use whatever icon you have here...

  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.isSpatialView()); }
  public isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; } // Allow snapping to terrain, etc. outside project extents...
  public requireWriteableTarget(): boolean { return false; } // Tool doesn't modify the imodel...
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }
  public onRestartTool(): void { this.exitTool(); }
  public onUnsuspend(): void { this.provideToolAssistance(); }

  protected provideToolAssistance(): void { } // ### TODO: Tool assistance...

  protected setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    this.provideToolAssistance();
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize(); // Calls onRestartTool to exit...
    return EventHandled.No;
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport)
      return EventHandled.No; // Shouldn't really happen...

    const deco = ProjectExtentsClipDecoration.get();
    if (undefined !== deco) {
      const origin = new Cartographic(Angle.createDegrees(2.35).radians, Angle.createDegrees(48.85).radians); // ### TODO: Need UI for lat/long/alt/angle...
      deco.updateEcefLocation(origin, ev.point);
    }

    this.onReinitialize(); // Calls onRestartTool to exit...
    return EventHandled.No;
  }

  public onInstall(): boolean { return ProjectExtentsClipDecoration.allowEcefLocationChange(false); } // ### TODO: Error message?

  public static startTool(): boolean { return new ProjectGeolocationPointTool().run(); }
}

/** Change or update geolocation direction to true north.
 * @beta
 */
export class ProjectGeolocationNorthTool extends PrimitiveTool {
  public static toolId = "ProjectLocation.Geolocation.North";
  public static iconSpec = "icon-sort-up"; // <== Tool button should use whatever icon you have here...
  public origin?: Point3d;
  public northDir?: Ray3d;

  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.isSpatialView()); }
  public isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; } // Allow snapping to terrain, etc. outside project extents...
  public requireWriteableTarget(): boolean { return false; } // Tool doesn't modify the imodel...
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }
  public onCleanup() { super.onCleanup(); this.unsuspendNorthDecoration(); }
  public onRestartTool(): void { this.exitTool(); }
  public onUnsuspend(): void { this.provideToolAssistance(); }

  protected provideToolAssistance(): void { } // ### TODO: Tool assistance...Enter reference point, Enter point to define north direction, etc...

  protected setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    this.provideToolAssistance();

    if (undefined === this.origin)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.setRotation(Matrix3d.createIdentity());
    hints.setOrigin(this.origin);
    hints.setModePolar();
    hints.setOriginFixed = true;
    hints.setLockZ = true;
    hints.sendHints();
  }

  private getAdjustedPoint(ev: BeButtonEvent): Point3d | undefined {
    if (undefined === this.origin)
      return undefined;
    return EditManipulator.HandleUtils.projectPointToPlaneInView(ev.point, this.origin, Vector3d.unitZ(), ev.viewport!, true);
  }

  private unsuspendNorthDecoration() {
    const deco = ProjectExtentsClipDecoration.get();
    if (undefined !== deco)
      deco.suspendNorthDecoration = false;
  }

  private updateNorthVector(ev: BeButtonEvent): void {
    if (undefined === ev.viewport)
      return;

    if (undefined === this.northDir)
      this.northDir = Ray3d.create(ev.point, Vector3d.unitY());
    else
      this.northDir.origin.setFrom(undefined !== this.origin ? this.origin : ev.point);

    const dirPt = this.getAdjustedPoint(ev);
    if (undefined === dirPt)
      return;

    this.northDir.direction.setStartEnd(this.northDir.origin, dirPt);
    if (this.northDir.direction.magnitude() < 1.0e-6)
      this.northDir.direction.setFrom(Vector3d.unitY());

    this.northDir.direction.z = 0.0;
    this.northDir.direction.normalizeInPlace();
  }

  public decorate(context: DecorateContext): void {
    if (undefined === this.northDir)
      return;

    const deco = ProjectExtentsClipDecoration.get();
    if (undefined === deco)
      return;

    deco.suspendNorthDecoration = true;
    deco.drawNorthArrow(context, this.northDir);
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

    if (undefined === this.origin) {
      this.origin = ev.point.clone();
      this.setupAndPromptForNextAction();
      return EventHandled.No;
    }

    this.updateNorthVector(ev);

    if (undefined !== this.northDir) {
      const deco = ProjectExtentsClipDecoration.get();
      if (undefined !== deco)
        deco.updateNorthDirection(this.northDir);
    }

    this.onReinitialize(); // Calls onRestartTool to exit...
    return EventHandled.No;
  }

  public onInstall(): boolean { return ProjectExtentsClipDecoration.allowEcefLocationChange(true); } // ### TODO: Error message...

  public static startTool(): boolean { return new ProjectGeolocationNorthTool().run(); }
}
