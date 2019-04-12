/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Range3d, ClipVector, ClipShape, ClipPrimitive, ClipPlane, ConvexClipPlaneSet, Plane3dByOriginAndUnitNormal, Vector3d, Point3d, Transform, Matrix3d, ClipMaskXYZRangePlanes, Geometry, ClipUtilities } from "@bentley/geometry-core";
import { Placement2d, Placement3d, Placement2dProps, ColorDef } from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { BeButtonEvent, EventHandled } from "./Tool";
import { LocateResponse } from "../ElementLocateManager";
import { Id64Arg } from "@bentley/bentleyjs-core";
import { Viewport, ViewUndoEvent, ScreenViewport } from "../Viewport";
import { TentativeOrAccuSnap } from "../AccuSnap";
import { PrimitiveTool } from "./PrimitiveTool";
import { DecorateContext } from "../ViewContext";
import { EditManipulator } from "./EditManipulator";
import { AccuDrawHintBuilder, AccuDraw } from "../AccuDraw";
import { StandardViewId } from "../StandardView";
import { GraphicType } from "../rendering";
import { HitDetail } from "../HitDetail";
import { CoordinateLockOverrides } from "./ToolAdmin";

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

/** @internal An object that can react to a view's clip being changed by tools or modify handles. */
export interface ViewClipEventHandler {
  selectOnCreate(): boolean; // Add newly created clip geometry to selection set and show modify controls.
  clearOnUnSelect(): boolean; // Stop displaying clip geometry when clip is removed from the selection set.
  onNewClip(viewport: Viewport): void; // Called by tools that set or replace the existing view clip with a new clip.
  onNewClipPlane(viewport: Viewport): void; // Called by tools that add a single plane to the view clip. When there is more than one plane, the new plane is always last.
  onModifyClip(viewport: Viewport): void; // Called by tools after modifying the view clip.
  onClearClip(viewport: Viewport): void; // Called when the view clip is cleared either by a tool or view undo.
}

/** @internal A tool to define a clip volume for a view */
export class ViewClipTool extends PrimitiveTool {
  constructor(protected _clipEventHandler?: ViewClipEventHandler) { super(); }

  public requireWriteableTarget(): boolean { return false; }
  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.allow3dManipulations()); }

  public onPostInstall(): void { super.onPostInstall(); this.setupAndPromptForNextAction(); }
  public onUnsuspend(): void { this.showPrompt(); }
  public onRestartTool(): void { this.exitTool(); }

  protected outputPrompt(prompt: string) { IModelApp.notifications.outputPromptByKey("CoreTools:tools.ViewClip." + prompt); }
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

  public static setViewClip(viewport: Viewport, saveInUndo: boolean, clip?: ClipVector): boolean {
    viewport.view.setViewClip(clip);
    viewport.synchWithView(saveInUndo);
    return true;
  }

  public static doClipToConvexClipPlaneSet(viewport: Viewport, saveInUndo: boolean, planes: ConvexClipPlaneSet): boolean {
    const prim = ClipPrimitive.createCapture(planes);
    const clip = ClipVector.createEmpty();
    clip.appendReference(prim);
    return this.setViewClip(viewport, saveInUndo, clip);
  }

  public static doClipToPlane(viewport: Viewport, saveInUndo: boolean, origin: Point3d, normal: Vector3d, clearExistingPlanes: boolean): boolean {
    const plane = Plane3dByOriginAndUnitNormal.create(origin, normal);
    if (undefined === plane)
      return false;
    let planeSet: ConvexClipPlaneSet | undefined;
    if (!clearExistingPlanes) {
      const existingClip = viewport.view.getViewClip();
      if (undefined !== existingClip && 1 === existingClip.clips.length) {
        const existingPrim = existingClip.clips[0];
        if (!(existingPrim instanceof ClipShape)) {
          const existingPlaneSets = existingPrim.fetchClipPlanesRef();
          if (undefined !== existingPlaneSets && 1 === existingPlaneSets.convexSets.length)
            planeSet = existingPlaneSets.convexSets[0];
        }
      }
    }
    if (undefined === planeSet)
      planeSet = ConvexClipPlaneSet.createEmpty();
    planeSet.addPlaneToConvexSet(ClipPlane.createPlane(plane));
    return this.doClipToConvexClipPlaneSet(viewport, saveInUndo, planeSet);
  }

  public static doClipToShape(viewport: Viewport, saveInUndo: boolean, xyPoints: Point3d[], transform: Transform, zLow?: number, zHigh?: number): boolean {
    const clip = ClipVector.createEmpty();
    clip.appendShape(xyPoints, zLow, zHigh, transform);
    return this.setViewClip(viewport, saveInUndo, clip);
  }

  public static doClipToRange(viewport: Viewport, saveInUndo: boolean, range: Range3d, transform?: Transform): boolean {
    if (range.isNull || range.isAlmostZeroX || range.isAlmostZeroY)
      return false;
    const clip = ClipVector.createEmpty();
    const block = ClipShape.createBlock(range, range.isAlmostZeroZ ? ClipMaskXYZRangePlanes.XAndY : ClipMaskXYZRangePlanes.All, false, false, transform);
    clip.appendReference(block);
    return this.setViewClip(viewport, saveInUndo, clip);
  }

  public static doClipClear(viewport: Viewport, saveInUndo: boolean): boolean {
    if (!ViewClipTool.hasClip(viewport))
      return false;
    return this.setViewClip(viewport, saveInUndo);
  }

  public static isSingleConvexClipPlaneSet(clip: ClipVector): ConvexClipPlaneSet | undefined {
    if (1 !== clip.clips.length)
      return undefined;
    const prim = clip.clips[0];
    if (prim instanceof ClipShape)
      return undefined;
    const planeSets = prim.fetchClipPlanesRef();
    return (undefined !== planeSets && 1 === planeSets.convexSets.length) ? planeSets.convexSets[0] : undefined;
  }

  public static hasClip(viewport: Viewport) {
    return (undefined !== viewport.view.peekDetail("clip"));
  }
}

/** @internal A tool to remove a clip volume for a view */
export class ViewClipClearTool extends ViewClipTool {
  public static toolId = "ViewClip.Clear";
  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && ViewClipTool.hasClip(vp)); }

  protected showPrompt(): void { this.outputPrompt("Clear.Prompts.FirstPoint"); }

  protected doClipClear(viewport: Viewport): boolean {
    if (!ViewClipTool.doClipClear(viewport, true))
      return false;
    if (undefined !== this._clipEventHandler)
      this._clipEventHandler.onClearClip(viewport);
    this.onReinitialize();
    return true;
  }

  public onPostInstall(): void {
    super.onPostInstall();
    if (undefined !== this.targetView)
      this.doClipClear(this.targetView);
  }

  public async onDataButtonDown(_ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.targetView)
      return EventHandled.No;
    return this.doClipClear(this.targetView) ? EventHandled.Yes : EventHandled.No;
  }
}

/** @internal A tool to define a clip volume for a view by specifying a plane */
export class ViewClipByPlaneTool extends ViewClipTool {
  public static toolId = "ViewClip.ByPlane";
  constructor(clipEventHandler?: ViewClipEventHandler, protected _orientation = ClipOrientation.Face, protected _clearExistingPlanes: boolean = false) { super(clipEventHandler); }

  protected showPrompt(): void { this.outputPrompt("ByPlane.Prompts.FirstPoint"); }

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
    if (!ViewClipTool.doClipToPlane(this.targetView, true, ev.point, normal, this._clearExistingPlanes))
      return EventHandled.No;
    if (undefined !== this._clipEventHandler)
      this._clipEventHandler.onNewClipPlane(this.targetView);
    this.onReinitialize();
    return EventHandled.Yes;
  }
}

/** @internal A tool to define a clip volume for a view by specifying a shape */
export class ViewClipByShapeTool extends ViewClipTool {
  public static toolId = "ViewClip.ByShape";
  protected readonly _points: Point3d[] = [];
  protected _matrix?: Matrix3d;
  protected _zLow?: number;
  protected _zHigh?: number;
  constructor(clipEventHandler?: ViewClipEventHandler, protected _orientation = ClipOrientation.Face) { super(clipEventHandler); }

  protected showPrompt(): void {
    switch (this._points.length) {
      case 0:
        this.outputPrompt("ByShape.Prompts.FirstPoint");
        break;
      case 1:
        this.outputPrompt("ByShape.Prompts.SecondPoint");
        break;
      case 2:
        this.outputPrompt("ByShape.Prompts.ThirdPoint");
        break;
      default:
        this.outputPrompt("ByShape.Prompts.Next");
        break;
    }
  }

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
    if (context.viewport !== this.targetView)
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
      if (!ViewClipTool.doClipToShape(this.targetView, true, points, transform, this._zLow, this._zHigh))
        return EventHandled.No;
      if (undefined !== this._clipEventHandler)
        this._clipEventHandler.onNewClip(this.targetView);
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
  public static toolId = "ViewClip.ByRange";
  protected _corner?: Point3d;

  protected showPrompt(): void { this.outputPrompt(undefined === this._corner ? "ByRange.Prompts.FirstPoint" : "ByRange.Prompts.NextPoint"); }

  protected setupAndPromptForNextAction(): void {
    super.setupAndPromptForNextAction();
    IModelApp.accuSnap.enableSnap(true);
  }

  protected getClipRange(range: Range3d, transform: Transform, ev: BeButtonEvent): boolean {
    if (undefined === this.targetView || undefined === this._corner)
      return false;
    // Creating clip aligned with ACS when ACS context lock is enabled...
    const matrix = ViewClipTool.getClipOrientation(ClipOrientation.Top, this.targetView);
    Transform.createOriginAndMatrix(this._corner, matrix, transform);
    const pt1 = transform.multiplyInversePoint3d(this._corner);
    const pt2 = transform.multiplyInversePoint3d(ev.point);
    if (undefined === pt1 || undefined === pt2)
      return false;
    range.setFrom(Range3d.create(pt1, pt2));
    return true;
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport !== this.targetView || undefined === this._corner)
      return;

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    const range = Range3d.create();
    const transform = Transform.createIdentity();
    if (!this.getClipRange(range, transform, ev))
      return;

    const builderAccVis = context.createGraphicBuilder(GraphicType.WorldDecoration, transform);
    const builderAccHid = context.createGraphicBuilder(GraphicType.WorldOverlay, transform);
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
      const range = Range3d.create();
      const transform = Transform.createIdentity();
      if (!this.getClipRange(range, transform, ev))
        return EventHandled.No;
      if (!ViewClipTool.doClipToRange(this.targetView, true, range, transform))
        return EventHandled.No;
      if (undefined !== this._clipEventHandler)
        this._clipEventHandler.onNewClip(this.targetView);
      this.onReinitialize();
      return EventHandled.Yes;
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
  public static toolId = "ViewClip.ByElement";
  constructor(clipEventHandler?: ViewClipEventHandler, protected _alwaysUseRange: boolean = false) { super(clipEventHandler); }

  protected showPrompt(): void { this.outputPrompt("ByElement.Prompts.FirstPoint"); }

  public onPostInstall(): void {
    super.onPostInstall();
    if (undefined !== this.targetView && this.targetView.iModel.selectionSet.isActive) {
      this.doClipToElements(this.targetView, this.targetView.iModel.selectionSet.elements, this._alwaysUseRange); // tslint:disable-line:no-floating-promises
      return;
    }
    IModelApp.accuSnap.enableLocate(true);
  }

  protected async doClipToElements(viewport: Viewport, ids: Id64Arg, alwaysUseRange: boolean = false): Promise<boolean> {
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
    if (!ViewClipTool.doClipToRange(viewport, true, range, transform))
      return false;
    if (undefined !== this._clipEventHandler)
      this._clipEventHandler.onNewClip(viewport);
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

/** @internal Interactive tool to modify a view's clip */
export class ViewClipModifyTool extends EditManipulator.HandleTool {
  protected _anchorIndex: number;
  protected _ids: string[];
  protected _base: Point3d[];
  protected _axis: Vector3d[];
  protected _clipView: Viewport;
  protected _clip: ClipVector;
  protected _restoreClip: boolean = true;

  public constructor(manipulator: EditManipulator.HandleProvider, hitId: string, ids: string[], base: Point3d[], axis: Vector3d[], vp: Viewport, clip: ClipVector) {
    super(manipulator);
    this._anchorIndex = ids.indexOf(hitId);
    this._ids = ids;
    this._base = base;
    this._axis = axis;
    this._clipView = vp;
    this._clip = clip;
  }

  protected init(): void {
    this.receivedDownEvent = true;
    this.initLocateElements(false, false, undefined, CoordinateLockOverrides.All); // Disable locate/snap/locks for control modification; overrides state inherited from suspended primitive...
    IModelApp.accuDraw.deactivate();
  }

  protected accept(ev: BeButtonEvent): boolean {
    const range = this.computeNewRange(ev);
    if (undefined === range)
      return false;
    ViewClipTool.doClipToRange(this._clipView, true, range);
    this._restoreClip = false;
    return true;
  }

  private computeNewRange(ev: BeButtonEvent): Range3d | undefined {
    if (-1 === this._anchorIndex || undefined === ev.viewport || ev.viewport !== this._clipView)
      return undefined;

    // NOTE: Use AccuDraw z instead of view z if AccuDraw is explicitly enabled...
    const projectedPt = EditManipulator.HandleUtils.projectPointToLineInView(ev.point, this._base[this._anchorIndex], this._axis[this._anchorIndex], ev.viewport, true);
    if (undefined === projectedPt)
      return undefined;

    const anchorPt = this._base[this._anchorIndex];
    const offsetVec = Vector3d.createStartEnd(anchorPt, projectedPt);
    let offset = offsetVec.normalizeWithLength(offsetVec).mag;
    if (offset < Geometry.smallMetricDistance)
      return;
    if (offsetVec.dotProduct(this._axis[this._anchorIndex]) < 0.0)
      offset *= -1.0;

    const adjustedPts: Point3d[] = [];
    for (let iFace = 0; iFace < this._ids.length; iFace++) {
      if (iFace === this._anchorIndex || this.manipulator.iModel.selectionSet.has(this._ids[iFace]))
        adjustedPts.push(this._base[iFace].plusScaled(this._axis[iFace], offset));
      else
        adjustedPts.push(this._base[iFace]);
    }

    const range = Range3d.create();
    range.extendArray(adjustedPts);

    return range;
  }

  public decorate(context: DecorateContext): void {
    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    const range = this.computeNewRange(ev);
    if (undefined === range)
      return;

    const builder = context.createGraphicBuilder(GraphicType.WorldOverlay);
    const color = ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor);

    builder.setSymbology(color, ColorDef.black, 2);
    builder.addRangeBox(range);
    context.addDecorationFromBuilder(builder);
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    const range = this.computeNewRange(ev);
    if (undefined === range)
      return;
    ViewClipTool.doClipToRange(this._clipView, false, range);
    this._clipView.invalidateDecorations();
  }

  public onCleanup(): void {
    if (this._restoreClip && ViewClipTool.hasClip(this._clipView))
      ViewClipTool.setViewClip(this._clipView, false, this._clip);
  }
}

/** @internal Controls to modify a view's clip */
export class ViewClipDecoration extends EditManipulator.HandleProvider {
  private static _decorator?: ViewClipDecoration;
  protected _clip?: ClipVector;
  protected _clipId?: string;
  protected _clipRange?: Range3d;
  protected _controlIds: string[] = [];
  protected _controlPoint: Point3d[] = [];
  protected _controlAxis: Vector3d[] = [];
  protected _removeViewCloseListener?: () => void;
  protected _removeViewUndoRedoListener?: () => void;

  public constructor(protected _clipView: Viewport, protected _clipEventHandler?: ViewClipEventHandler) {
    super(_clipView.iModel);
    this._clipId = this.iModel.transientIds.next;
    this.getClipData();
    this.updateDecorationListener(true);
    this._removeViewCloseListener = IModelApp.viewManager.onViewClose.addListener(this.onViewClose, this);
    this._removeViewUndoRedoListener = this._clipView.onViewUndoRedo.addListener(this.onViewUndoRedo, this);
    if (undefined !== this._clipEventHandler && this._clipEventHandler.selectOnCreate())
      this.iModel.selectionSet.replace(this._clipId);
  }

  public get clipId(): string | undefined { return this._clipId; }

  protected stop(): void {
    const selectedId = (undefined !== this._clipId && this.iModel.selectionSet.has(this._clipId)) ? this._clipId : undefined;
    this._clipId = undefined; // Invalidate id so that decorator will be dropped...
    super.stop();
    if (undefined !== selectedId)
      this.iModel.selectionSet.remove(selectedId); // Don't leave decorator id in selection set...
    if (undefined !== this._removeViewCloseListener) {
      this._removeViewCloseListener();
      this._removeViewCloseListener = undefined;
    }
    if (undefined !== this._removeViewUndoRedoListener) {
      this._removeViewUndoRedoListener();
      this._removeViewUndoRedoListener = undefined;
    }
  }

  public onViewClose(vp: ScreenViewport): void {
    if (this._clipView === vp)
      ViewClipDecoration.clear();
  }

  public onViewUndoRedo(vp: Viewport, _event: ViewUndoEvent): void {
    if (this._clipView !== vp)
      return;
    this.onManipulatorEvent(EditManipulator.EventType.Synch);
    if (undefined !== this._clip)
      return;
    if (undefined !== this._clipEventHandler)
      this._clipEventHandler.onClearClip(vp);
    ViewClipDecoration.clear();
  }

  private getClipData(): boolean {
    this._clip = this._clipRange = undefined;
    if (undefined === this._clipId)
      return false;
    const clip = this._clipView.view.getViewClip();
    if (undefined === clip)
      return false;
    // ##TODO Create proper handles for clip shape w/transform and clip planes primitive...
    const range = this._clipView.computeViewRange();
    const clipRange = Range3d.create();
    for (const clipPrim of clip.clips) {
      const clipPlaneSet = clipPrim.fetchClipPlanesRef();
      if (undefined === clipPlaneSet)
        continue;
      for (const convexSet of clipPlaneSet.convexSets)
        clipRange.extendRange(ClipUtilities.rangeOfConvexClipPlaneSetIntersectionWithRange(convexSet, range));
    }
    if (clipRange.isNull)
      return false;
    this._clip = clip;
    this._clipRange = clipRange;
    return true;
  }

  protected async createControls(): Promise<boolean> {
    // Always update to current view clip to handle view undo/redo, post-modify, etc.
    if (!this.getClipData())
      return false;

    // Show controls if only range box and it's controls are selected, selection set doesn't include any other elements...
    let showControls = false;
    if (this.iModel.selectionSet.size <= this._controlIds.length + 1 && this.iModel.selectionSet.has(this._clipId)) {
      showControls = true;
      if (this.iModel.selectionSet.size > 1) {
        this.iModel.selectionSet.elements.forEach((val) => {
          if (this._clipId !== val && !this._controlIds.includes(val))
            showControls = false;
        });
      }
    }

    if (!showControls) {
      if (undefined !== this._clipEventHandler && this._clipEventHandler.clearOnUnSelect())
        ViewClipDecoration.clear();
      return false;
    }

    const transientIds = this.iModel.transientIds;
    if (0 === this._controlIds.length) {
      this._controlIds[0] = transientIds.next;
      this._controlIds[1] = transientIds.next;
      this._controlIds[2] = transientIds.next;
      this._controlIds[3] = transientIds.next;
      this._controlIds[4] = transientIds.next;
      this._controlIds[5] = transientIds.next;
    }

    const xOffset = 0.5 * this._clipRange!.xLength();
    const yOffset = 0.5 * this._clipRange!.yLength();
    const zOffset = 0.5 * this._clipRange!.zLength();
    const center = this._clipRange!.center;

    this._controlAxis[0] = Vector3d.unitX();
    this._controlAxis[1] = Vector3d.unitX(-1.0);
    this._controlPoint[0] = center.plusScaled(this._controlAxis[0], xOffset);
    this._controlPoint[1] = center.plusScaled(this._controlAxis[1], xOffset);

    this._controlAxis[2] = Vector3d.unitY();
    this._controlAxis[3] = Vector3d.unitY(-1.0);
    this._controlPoint[2] = center.plusScaled(this._controlAxis[2], yOffset);
    this._controlPoint[3] = center.plusScaled(this._controlAxis[3], yOffset);

    this._controlAxis[4] = Vector3d.unitZ();
    this._controlAxis[5] = Vector3d.unitZ(-1.0);
    this._controlPoint[4] = center.plusScaled(this._controlAxis[4], zOffset);
    this._controlPoint[5] = center.plusScaled(this._controlAxis[5], zOffset);

    return true;
  }

  protected clearControls(): void {
    this.iModel.selectionSet.remove(this._controlIds); // Remove any selected controls as they won't continue to be displayed...
    super.clearControls();
  }

  protected modifyControls(hit: HitDetail, _ev: BeButtonEvent): boolean {
    if (undefined === this._clip)
      return false;
    const manipTool = new ViewClipModifyTool(this, hit.sourceId, this._controlIds, this._controlPoint, this._controlAxis, this._clipView, this._clip);
    return manipTool.run();
  }

  public onManipulatorEvent(eventType: EditManipulator.EventType): void {
    super.onManipulatorEvent(eventType);
    if (EditManipulator.EventType.Accept === eventType && undefined !== this._clipEventHandler)
      this._clipEventHandler.onModifyClip(this._clipView);
  }

  public testDecorationHit(id: string): boolean { return (id === this._clipId || this._controlIds.includes(id)); }
  public async getDecorationToolTip(hit: HitDetail): Promise<HTMLElement | string> { return (hit.sourceId === this._clipId ? "View Clip" : "Modify View Clip"); }
  public async onDecorationButtonEvent(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> { return (hit.sourceId === this._clipId ? EventHandled.No : super.onDecorationButtonEvent(hit, ev)); }
  protected updateDecorationListener(_add: boolean): void { super.updateDecorationListener(undefined !== this._clipId); } // Decorator isn't just for resize controls...

  public decorate(context: DecorateContext): void {
    if (undefined === this._clipId || undefined === this._clip)
      return;

    const vp = context.viewport;
    if (this._clipView !== vp)
      return;

    const builder = context.createGraphicBuilder(GraphicType.WorldOverlay, undefined, this._clipId);
    const color = ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor);

    builder.setSymbology(color, ColorDef.black, 3);
    builder.addRangeBox(this._clipRange!);
    context.addDecorationFromBuilder(builder);

    if (!this._isActive)
      return;

    const outlineColor = ColorDef.from(0, 0, 0, 50);
    const fillVisColor = ColorDef.from(150, 250, 200, 225);
    const fillHidColor = fillVisColor.clone(); fillHidColor.setAlpha(200);
    const shapePts = EditManipulator.HandleUtils.getArrowShape(0.0, 0.15, 0.55, 1.0, 0.3, 0.5, 0.1);

    for (let iFace = 0; iFace < this._controlIds.length; iFace++) {
      const transform = EditManipulator.HandleUtils.getArrowTransform(vp, this._controlPoint[iFace], this._controlAxis[iFace], 0.75);
      if (undefined === transform)
        continue;

      const visPts: Point3d[] = []; for (const pt of shapePts) visPts.push(pt.clone()); // deep copy because we're using a builder transform...
      const hidPts: Point3d[] = []; for (const pt of shapePts) hidPts.push(pt.clone());
      const arrowVisBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay, transform, this._controlIds[iFace]);
      const arrowHidBuilder = context.createGraphicBuilder(GraphicType.WorldDecoration, transform);

      arrowVisBuilder.setSymbology(outlineColor, outlineColor, 2);
      arrowVisBuilder.addLineString(visPts);
      arrowVisBuilder.setBlankingFill(fillVisColor);
      arrowVisBuilder.addShape(visPts);
      context.addDecorationFromBuilder(arrowVisBuilder);

      arrowHidBuilder.setSymbology(fillHidColor, fillHidColor, 1);
      arrowHidBuilder.addShape(hidPts);
      context.addDecorationFromBuilder(arrowHidBuilder);
    }
  }

  public static create(vp: Viewport, clipEventHandler?: ViewClipEventHandler): string | undefined {
    if (undefined !== ViewClipDecoration._decorator)
      ViewClipDecoration.clear();
    if (!ViewClipTool.hasClip(vp))
      return undefined;
    ViewClipDecoration._decorator = new ViewClipDecoration(vp, clipEventHandler);
    return ViewClipDecoration._decorator.clipId;
  }

  public static clear(): void {
    if (undefined === ViewClipDecoration._decorator)
      return;
    ViewClipDecoration._decorator.stop();
    ViewClipDecoration._decorator = undefined;
  }

  public static toggle(vp: Viewport, clipEventHandler?: ViewClipEventHandler): string | undefined {
    let clipId: string | undefined;
    if (undefined === ViewClipDecoration._decorator)
      clipId = ViewClipDecoration.create(vp, clipEventHandler);
    else
      ViewClipDecoration.clear();
    IModelApp.toolAdmin.startDefaultTool();
    return clipId;
  }
}

/** @internal An implementation of ViewClipEventHandler that responds to new clips by presenting clip modification handles */
export class ViewClipDecorationProvider implements ViewClipEventHandler {
  private static _provider?: ViewClipDecorationProvider;
  public selectOnCreate(): boolean { return true; }
  public clearOnUnSelect(): boolean { return true; }
  public onNewClip(viewport: Viewport): void { ViewClipDecoration.create(viewport, this); }
  public onNewClipPlane(viewport: Viewport): void { this.onNewClip(viewport); }
  public onModifyClip(_viewport: Viewport): void { }
  public onClearClip(_viewport: Viewport): void { }

  public showDecoration(vp: Viewport): void { ViewClipDecoration.create(vp, this); }
  public hideDecoration(): void { ViewClipDecoration.clear(); }
  public toggleDecoration(vp: Viewport): void { ViewClipDecoration.toggle(vp, this); }

  public static create(): ViewClipDecorationProvider {
    if (undefined === ViewClipDecorationProvider._provider) {
      ViewClipDecoration.clear();
      ViewClipDecorationProvider._provider = new ViewClipDecorationProvider();
    }
    return ViewClipDecorationProvider._provider;
  }

  public static clear(): void {
    if (undefined === ViewClipDecorationProvider._provider)
      return;
    ViewClipDecoration.clear();
    ViewClipDecorationProvider._provider = undefined;
  }
}
