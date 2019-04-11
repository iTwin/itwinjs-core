/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Range3d, ClipVector, ClipMaskXYZRangePlanes, ClipShape, ClipPrimitive, ClipPlane, ConvexClipPlaneSet, Plane3dByOriginAndUnitNormal, Vector3d, Point3d, Transform, Matrix3d } from "@bentley/geometry-core";
import { Placement2d, Placement3d, Placement2dProps, ColorDef } from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { BeButtonEvent, EventHandled } from "./Tool";
import { LocateResponse } from "../ElementLocateManager";
import { Id64Arg } from "@bentley/bentleyjs-core";
import { Viewport } from "../Viewport";
import { TentativeOrAccuSnap } from "../AccuSnap";
import { PrimitiveTool } from "./PrimitiveTool";
import { DecorateContext } from "../ViewContext";
import { EditManipulator } from "./EditManipulator";
import { AccuDrawHintBuilder, AccuDraw } from "../AccuDraw";
import { StandardViewId } from "../StandardView";
import { GraphicType } from "../rendering";

/** @internal The orientation to use to define the view clip volume */
export const enum ClipOrientation {
  Top,
  Front,
  Left,
  Bottom,
  Back,
  Right,
  View,
  Face,
}

/** @internal A tool to define a clip volume for a view */
export class ViewClipTool extends PrimitiveTool {
  public requireWriteableTarget(): boolean { return false; }
  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.allow3dManipulations()); }

  public onPostInstall(): void { super.onPostInstall(); this.setupAndPromptForNextAction(); }
  public onUnsuspend(): void { this.showPrompt(); }
  public onRestartTool(): void { this.exitTool(); }

  protected showPrompt(): void { }
  protected setupAndPromptForNextAction(): void { this.showPrompt(); }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> { this.onReinitialize(); return EventHandled.No; }

  public static getPlaneInwardNormal(orientation: ClipOrientation, viewport: Viewport): Vector3d | undefined {
    const matrix = ViewClipTool.getClipOrientation(orientation, viewport);
    if (undefined === matrix)
      return undefined;
    return matrix.getColumn(2).negate();
  }

  public static getClipOrientation(orientation: ClipOrientation, viewport: Viewport): Matrix3d | undefined {
    switch (orientation) {
      case ClipOrientation.Top:
        return AccuDraw.getStandardRotation(StandardViewId.Top, viewport, viewport.isContextRotationRequired).inverse();
      case ClipOrientation.Front:
        return AccuDraw.getStandardRotation(StandardViewId.Front, viewport, viewport.isContextRotationRequired).inverse();
      case ClipOrientation.Left:
        return AccuDraw.getStandardRotation(StandardViewId.Left, viewport, viewport.isContextRotationRequired).inverse();
      case ClipOrientation.Bottom:
        return AccuDraw.getStandardRotation(StandardViewId.Bottom, viewport, viewport.isContextRotationRequired).inverse();
      case ClipOrientation.Back:
        return AccuDraw.getStandardRotation(StandardViewId.Back, viewport, viewport.isContextRotationRequired).inverse();
      case ClipOrientation.Right:
        return AccuDraw.getStandardRotation(StandardViewId.Right, viewport, viewport.isContextRotationRequired).inverse();
      case ClipOrientation.View:
        return viewport.view.getRotation().inverse();
      case ClipOrientation.Face:
        const snap = TentativeOrAccuSnap.getCurrentSnap(false);
        if (undefined === snap || undefined === snap.normal)
          return undefined;
        const normal = Vector3d.createZero();
        const boresite = EditManipulator.HandleUtils.getBoresite(snap.hitPoint, viewport);
        if (snap.normal.dotProduct(boresite.direction) < 0.0)
          normal.setFrom(snap.normal);
        else
          snap.normal.negate(normal);
        return Matrix3d.createRigidHeadsUp(normal);
    }
    return undefined;
  }

  public static doClipToPlane(viewport: Viewport, origin: Point3d, normal: Vector3d, clearExistingPlanes: boolean): boolean {
    const plane = Plane3dByOriginAndUnitNormal.create(origin, normal);
    if (undefined === plane)
      return false;
    let planeSet: ConvexClipPlaneSet | undefined;
    if (!clearExistingPlanes) {
      const existingClip = viewport.view.getViewClip();
      if (undefined !== existingClip && 1 === existingClip.clips.length) {
        const existingPrim = existingClip.clips[0];
        if (!(existingPrim instanceof ClipShape)) {
          const existingPlaneSets = existingClip.clips[0].fetchClipPlanesRef();
          if (undefined !== existingPlaneSets && 1 === existingPlaneSets.convexSets.length)
            planeSet = existingPlaneSets.convexSets[0];
        }
      }
    }
    if (undefined === planeSet)
      planeSet = ConvexClipPlaneSet.createEmpty();
    planeSet.addPlaneToConvexSet(ClipPlane.createPlane(plane));
    const prim = ClipPrimitive.createCapture(planeSet);
    const clip = ClipVector.createEmpty();
    clip.appendReference(prim);
    viewport.view.setViewClip(clip);
    viewport.synchWithView(true);
    return true;
  }

  public static doClipToShape(viewport: Viewport, xyPoints: Point3d[], transform: Transform, zLow?: number, zHigh?: number): boolean {
    const clip = ClipVector.createEmpty();
    clip.appendShape(xyPoints, zLow, zHigh, transform);
    viewport.view.setViewClip(clip);
    viewport.synchWithView(true);
    return true;
  }

  public static doClipToRange(viewport: Viewport, range: Range3d, transform?: Transform): boolean {
    if (range.isNull || range.isAlmostZeroX || range.isAlmostZeroY)
      return false;
    const clip = ClipVector.createEmpty();
    const block = ClipShape.createBlock(range, range.isAlmostZeroZ ? ClipMaskXYZRangePlanes.XAndY : ClipMaskXYZRangePlanes.All, false, false, transform);
    clip.appendReference(block);
    viewport.view.setViewClip(clip);
    viewport.synchWithView(true);
    return true;
  }

  public static doClipClear(viewport: Viewport): boolean {
    if (undefined === viewport.view.peekDetail("clip"))
      return false;
    viewport.view.setViewClip();
    viewport.synchWithView(true);
    return true;
  }
}

/** @internal A tool to remove a clip volume for a view */
export class ViewClipClearTool extends ViewClipTool {
  public static toolId = "View.ClipClear";
  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && undefined !== vp.view.peekDetail("clip")); }

  public onPostInstall(): void {
    super.onPostInstall();
    if (undefined !== this.targetView) {
      ViewClipTool.doClipClear(this.targetView);
      this.onReinitialize();
    }
  }

  public async onDataButtonDown(_ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.targetView)
      return EventHandled.No;
    if (!ViewClipTool.doClipClear(this.targetView))
      return EventHandled.No;
    this.onReinitialize();
    return EventHandled.Yes;
  }
}

/** @internal A tool to define a clip volume for a view by specifying a plane */
export class ViewClipByPlaneTool extends ViewClipTool {
  public static toolId = "View.ClipByPlane";
  constructor(protected _orientation = ClipOrientation.Face, protected _clearExistingPlanes: boolean = false) { super(); }

  protected setupAndPromptForNextAction(): void {
    super.setupAndPromptForNextAction();
    IModelApp.accuSnap.enableSnap(true);
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.targetView)
      return EventHandled.No;
    const normal = ViewClipTool.getPlaneInwardNormal(this._orientation, this.targetView);
    if (undefined === normal)
      return EventHandled.No;
    if (!ViewClipTool.doClipToPlane(this.targetView, ev.point, normal, this._clearExistingPlanes))
      return EventHandled.No;
    this.onReinitialize();
    return EventHandled.Yes;
  }
}

/** @internal A tool to define a clip volume for a view by specifying a shape */
export class ViewClipByShapeTool extends ViewClipTool {
  public static toolId = "View.ClipByShape";
  protected readonly _points: Point3d[] = [];
  protected _matrix?: Matrix3d;
  constructor(protected _orientation = ClipOrientation.Face) { super(); }

  protected setupAndPromptForNextAction(): void {
    super.setupAndPromptForNextAction();
    IModelApp.accuSnap.enableSnap(true);
    if (0 === this._points.length)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.setOrigin(this._points[this._points.length - 1]);
    hints.setRotation(this._matrix!.inverse()!);
    hints.setLockZ = true;
    hints.sendHints();
  }

  protected getClipPoints(ev: BeButtonEvent): Point3d[] {
    const points: Point3d[] = [];
    if (undefined === this.targetView || this._points.length < 1)
      return points;
    for (const pt of this._points)
      points.push(pt.clone());

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

  public isValidLocation(ev: BeButtonEvent, isButtonEvent: boolean): boolean {
    return (this._points.length > 0 ? true : super.isValidLocation(ev, isButtonEvent));
  }

  public decorate(context: DecorateContext): void {
    if (!context.viewport.view.allow3dManipulations())
      return;

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    const points = this.getClipPoints(ev);
    if (points.length < 2)
      return;

    const builderAccVis = context.createGraphicBuilder(GraphicType.WorldDecoration);
    const builderAccHid = context.createGraphicBuilder(GraphicType.WorldOverlay);
    const colorAccVis = ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor);
    const colorAccHid = colorAccVis.clone(); colorAccHid.setAlpha(100);
    const fillAccVis = context.viewport.hilite.color.clone(); fillAccVis.setAlpha(25);

    builderAccVis.setSymbology(colorAccVis, fillAccVis, 3);
    builderAccHid.setSymbology(colorAccHid, fillAccVis, 1);

    if (points.length > 2)
      builderAccHid.addShape(points);

    builderAccVis.addLineString(points);
    builderAccHid.addLineString(points);

    context.addDecorationFromBuilder(builderAccVis);
    context.addDecorationFromBuilder(builderAccHid);
  }

  public decorateSuspended(context: DecorateContext): void { this.decorate(context); }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> { if (this._points.length > 0 && undefined !== ev.viewport) ev.viewport.invalidateDecorations(); }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.targetView)
      return EventHandled.No;

    if (this._points.length > 1 && !ev.isControlKey) {
      const points = this.getClipPoints(ev);
      if (points.length < 3)
        return EventHandled.No;

      const transform = Transform.createOriginAndMatrix(points[0], this._matrix);
      transform.multiplyInversePoint3dArrayInPlace(points);
      if (!ViewClipTool.doClipToShape(this.targetView, points, transform))
        return EventHandled.No;
      this.onReinitialize();
      return EventHandled.Yes;
    }

    if (undefined === this._matrix && undefined === (this._matrix = ViewClipTool.getClipOrientation(this._orientation, this.targetView)))
      return EventHandled.No;

    const currPt = ev.point.clone();
    if (this._points.length > 0) {
      const planePt = EditManipulator.HandleUtils.projectPointToPlaneInView(currPt, this._points[0], this._matrix!.getColumn(2), ev.viewport!, true);
      if (undefined !== planePt)
        currPt.setFrom(planePt);
    }

    this._points.push(currPt);
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this._points.length)
      return false;

    this._points.pop();
    if (0 === this._points.length)
      this.onReinitialize();
    else
      this.setupAndPromptForNextAction();
    return true;
  }
}

/** @internal A tool to define a clip volume for a view by specifying range corners */
export class ViewClipByRangeTool extends ViewClipTool {
  public static toolId = "View.ClipByRange";
  protected _corner?: Point3d;

  protected setupAndPromptForNextAction(): void {
    super.setupAndPromptForNextAction();
    IModelApp.accuSnap.enableSnap(true);
  }

  public decorate(context: DecorateContext): void {
    if (!context.viewport.view.allow3dManipulations() || undefined === this._corner)
      return;

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    const range = Range3d.create(this._corner, ev.point);

    const builderAccVis = context.createGraphicBuilder(GraphicType.WorldDecoration);
    const builderAccHid = context.createGraphicBuilder(GraphicType.WorldOverlay);
    const colorAccVis = ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor);
    const colorAccHid = colorAccVis.clone(); colorAccHid.setAlpha(100);

    builderAccVis.setSymbology(colorAccVis, ColorDef.black, 3);
    builderAccHid.setSymbology(colorAccHid, ColorDef.black, 1);

    builderAccVis.addRangeBox(range);
    builderAccHid.addRangeBox(range);

    context.addDecorationFromBuilder(builderAccVis);
    context.addDecorationFromBuilder(builderAccHid);
  }

  public decorateSuspended(context: DecorateContext): void { this.decorate(context); }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> { if (undefined !== this._corner && undefined !== ev.viewport) ev.viewport.invalidateDecorations(); }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.targetView)
      return EventHandled.No;

    if (undefined !== this._corner) {
      const range = Range3d.create(this._corner, ev.point);
      if (!ViewClipTool.doClipToRange(this.targetView, range))
        return EventHandled.No;
      this.onReinitialize();
      EventHandled.Yes;
    }

    this._corner = ev.point.clone();
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (undefined === this._corner)
      return false;
    this.onReinitialize();
    return true;
  }
}

/** @internal A tool to define a clip volume for a view by element(s) */
export class ViewClipByElementTool extends ViewClipTool {
  public static toolId = "View.ClipByElement";
  constructor(protected _alwaysUseRange: boolean = false) { super(); }

  public onPostInstall(): void {
    super.onPostInstall();
    if (undefined !== this.targetView && this.targetView.iModel.selectionSet.isActive) {
      this.doClipToElements(this.targetView, this.targetView.iModel.selectionSet.elements, this._alwaysUseRange); // tslint:disable-line:no-floating-promises
      return;
    }
    IModelApp.accuSnap.enableLocate(true);
  }

  public async doClipToElements(viewport: Viewport, ids: Id64Arg, alwaysUseRange: boolean = false): Promise<boolean> {
    const elementProps = await viewport.iModel.elements.getProps(ids);
    if (0 === elementProps.length)
      return false;
    const range = new Range3d();
    const transform = Transform.createIdentity();
    for (const props of elementProps) {
      if (undefined === props.placement)
        continue;
      const hasAngle = (arg: any): arg is Placement2dProps => arg.angle !== undefined;
      const placement = hasAngle(props.placement) ? Placement2d.fromJSON(props.placement) : Placement3d.fromJSON(props.placement);
      if (!alwaysUseRange && 1 === elementProps.length) {
        range.setFrom(placement instanceof Placement2d ? Range3d.createRange2d(placement.bbox, 0) : placement.bbox);
        transform.setFrom(placement.transform); // Use ElementAlignedBox for single selection...
      } else {
        range.extendRange(placement.calculateRange());
      }
    }
    if (!ViewClipTool.doClipToRange(viewport, range, transform))
      return false;
    this.onReinitialize();
    return true;
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.targetView)
      return EventHandled.No;
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (undefined === hit || !hit.isElementHit)
      return EventHandled.No;
    return await this.doClipToElements(this.targetView, hit.sourceId, this._alwaysUseRange) ? EventHandled.Yes : EventHandled.No;
  }
}
