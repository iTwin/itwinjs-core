/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { BeButtonEvent, BeCursor, BeWheelEvent, CoordSource, InteractiveTool, EventHandled, BeTouchEvent, BeButton } from "./Tool";
import { Viewport, CoordSystem, DepthRangeNpc, ViewRect } from "../Viewport";
import { Angle, Point3d, Vector3d, YawPitchRollAngles, Point2d, Vector2d, RotMatrix, Transform, Range3d, Arc3d } from "@bentley/geometry-core";
import { Frustum, NpcCenter, Npc, ColorDef, ViewFlags, RenderMode } from "@bentley/imodeljs-common";
import { MarginPercent, ViewStatus, ViewState3d } from "../ViewState";
import { IModelApp } from "../IModelApp";
import { DecorateContext } from "../ViewContext";
import { TentativeOrAccuSnap } from "../AccuSnap";
import { GraphicBuilder } from "../rendering";
import { ToolSettings } from "./ToolAdmin";

export const enum ViewHandleWeight {
  Thin = 1,
  Normal = 2,
  Bold = 3,
  VeryBold = 4,
  FatDot = 8,
}

export const enum ViewHandleType {
  None = 0,
  Rotate = 1,
  TargetCenter = 1 << 1,
  Pan = 1 << 2,
  Scroll = 1 << 3,
  Zoom = 1 << 4,
  Walk = 1 << 5,
  Fly = 1 << 6,
  Look = 1 << 7,
}

export const enum ViewManipPriority {
  Low = 1,
  Normal = 10,
  Medium = 100,
  High = 1000,
}

const enum OrientationResult {
  Success = 0,
  NoEvent = 1,
  Disabled = 2,
  RejectedByController = 3,
}

const enum NavigateMode { Pan = 0, Look = 1, Travel = 2 }

/** An InteractiveTool that manipulates a view. */
export abstract class ViewTool extends InteractiveTool {
  public inDynamicUpdate = false;
  public beginDynamicUpdate() { this.inDynamicUpdate = true; }
  public endDynamicUpdate() { this.inDynamicUpdate = false; }
  public run(): boolean {
    const toolAdmin = IModelApp.toolAdmin;
    if (!toolAdmin.onInstallTool(this))
      return false;

    toolAdmin.startViewTool(this);
    toolAdmin.onPostInstallTool(this);
    return true;
  }

  public async onResetButtonUp(_ev: BeButtonEvent) { this.exitTool(); return EventHandled.Yes; }

  /** Do not override. */
  public exitTool(): void { IModelApp.toolAdmin.exitViewTool(); }
}

/** @hidden */
export abstract class ViewingToolHandle {
  constructor(public viewTool: ViewManip) { }
  public onReinitialize(): void { }
  public focusOut(): void { }
  public noMotion(_ev: BeButtonEvent): boolean { return false; }
  public motion(_ev: BeButtonEvent): boolean { return false; }
  public checkOneShot(): boolean { return true; }
  public getHandleCursor(): BeCursor { return BeCursor.Default; }
  public abstract doManipulation(ev: BeButtonEvent, inDynamics: boolean): boolean;
  public abstract firstPoint(ev: BeButtonEvent): boolean;
  public abstract testHandleForHit(ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean;
  public abstract get handleType(): ViewHandleType;
  public focusIn(): void { IModelApp.toolAdmin.setCursor(this.getHandleCursor()); }
  public drawHandle(_context: DecorateContext, _hasFocus: boolean): void { }
}

/** @hidden */
export class ViewHandleArray {
  public handles: ViewingToolHandle[] = [];
  public focus = -1;
  public focusDrag = false;
  public hitHandleIndex = 0;
  public viewport?: Viewport;
  constructor(public viewTool: ViewManip) { }

  public empty() {
    this.focus = -1;
    this.focusDrag = false;
    this.hitHandleIndex = -1; // setting to -1 will result in onReinitialize getting called before testHit which sets the hit index
    this.handles.length = 0;
  }

  public get count(): number { return this.handles.length; }
  public get hitHandle(): ViewingToolHandle | undefined { return this.getByIndex(this.hitHandleIndex); }
  public get focusHandle(): ViewingToolHandle | undefined { return this.getByIndex(this.focus); }
  public add(handle: ViewingToolHandle): void { this.handles.push(handle); }
  public getByIndex(index: number): ViewingToolHandle | undefined { return (index >= 0 && index < this.count) ? this.handles[index] : undefined; }
  public focusHitHandle(): void { this.setFocus(this.hitHandleIndex); }

  public testHit(ptScreen: Point3d, forced = ViewHandleType.None): boolean {
    this.hitHandleIndex = -1;
    const data = { distance: 0.0, priority: ViewManipPriority.Normal };
    let minDistance = 0.0;
    let minDistValid = false;
    let highestPriority = ViewManipPriority.Low;
    let nearestHitHandle: ViewingToolHandle | undefined;

    for (let i = 0; i < this.count; i++) {
      data.priority = ViewManipPriority.Normal;
      const handle = this.handles[i];

      if (forced) {
        if (handle.handleType === forced) {
          this.hitHandleIndex = i;
          return true;
        }
      } else if (handle.testHandleForHit(ptScreen, data)) {
        if (data.priority >= highestPriority) {
          if (data.priority > highestPriority)
            minDistValid = false;

          highestPriority = data.priority;

          if (!minDistValid || (data.distance < minDistance)) {
            minDistValid = true;
            minDistance = data.distance;
            nearestHitHandle = handle;
            this.hitHandleIndex = i;
          }
        }
      }
    }
    return undefined !== nearestHitHandle;
  }

  public drawHandles(context: DecorateContext): void {
    if (0 === this.count)
      return;

    // all handle objects must draw themselves
    for (let i = 0; i < this.count; ++i) {
      if (i !== this.hitHandleIndex) {
        const handle = this.handles[i];
        handle.drawHandle(context, this.focus === i);
      }
    }

    // draw the hit handle last
    if (-1 !== this.hitHandleIndex) {
      const handle = this.handles[this.hitHandleIndex];
      handle.drawHandle(context, this.focus === this.hitHandleIndex);
    }
  }

  public setFocus(index: number): void {
    if (this.focus === index && (this.focusDrag === this.viewTool.inHandleModify))
      return;

    let focusHandle: ViewingToolHandle | undefined;
    if (this.focus >= 0) {
      focusHandle = this.getByIndex(this.focus);
      if (focusHandle)
        focusHandle.focusOut();
    }

    if (index >= 0) {
      focusHandle = this.getByIndex(index);
      if (focusHandle)
        focusHandle.focusIn();
    }

    this.focus = index;
    this.focusDrag = this.viewTool.inHandleModify;

    if (undefined !== this.viewport)
      this.viewport.invalidateDecorations();
  }

  public onReinitialize() { this.handles.forEach((handle) => handle.onReinitialize()); }
  public motion(ev: BeButtonEvent) { this.handles.forEach((handle) => handle.motion(ev)); }

  /** determine whether a handle of a specific type exists */
  public hasHandle(handleType: ViewHandleType): boolean { return this.handles.some((handle) => handle.handleType === handleType); }
}

/** Base class for tools that manipulate the frustum of a Viewport. */
export abstract class ViewManip extends ViewTool {
  public viewport?: Viewport = undefined;
  public viewHandles: ViewHandleArray;
  public frustumValid = false;
  public readonly targetCenterWorld = new Point3d();
  public inHandleModify = false;
  public isDragging = false;
  public stoppedOverHandle = false;
  public targetCenterValid = false;
  public targetCenterLocked = false;
  public nPts = 0;
  protected _forcedHandle = ViewHandleType.None;
  public readonly lastFrustum = new Frustum();

  constructor(viewport: Viewport | undefined, public handleMask: number, public oneShot: boolean, public isDraggingRequired: boolean = false) {
    super();
    this.viewHandles = new ViewHandleArray(this);
    this.changeViewport(viewport);
  }

  public decorate(context: DecorateContext): void { this.viewHandles.drawHandles(context); }

  public onReinitialize(): void {
    if (undefined !== this.viewport) {
      this.viewport.synchWithView(true); // make sure we store any changes in view undo buffer.
      this.viewHandles.setFocus(-1);
    }

    this.nPts = 0;
    this.inHandleModify = false;
    this.inDynamicUpdate = false;
    this.frustumValid = false;

    this.viewHandles.onReinitialize();
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    // Tool was started in "drag required" mode, don't advance tool state and wait to see if we get the start drag event.
    if (0 === this.nPts && this.isDraggingRequired && !this.isDragging)
      return EventHandled.No;

    switch (this.nPts) {
      case 0:
        this.changeViewport(ev.viewport);
        if (this.processFirstPoint(ev))
          this.nPts = 1;
        break;
      case 1:
        this.nPts = 2;
        break;
    }

    if (this.nPts > 1) {
      this.inDynamicUpdate = false;
      if (this.processPoint(ev, false) && this.oneShot)
        this.exitTool();
      else
        this.onReinitialize();
    }

    return EventHandled.Yes;
  }

  public async onDataButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    if (this.nPts <= 1 && this.isDraggingRequired && !this.isDragging && this.oneShot)
      this.exitTool();

    return EventHandled.No;
  }

  public async onMouseWheel(inputEv: BeWheelEvent): Promise<EventHandled> {
    const ev = inputEv.clone();

    // If the rotate is active, the mouse wheel should work as if the cursor is at the target center
    if ((this.handleMask & ViewHandleType.Rotate)) {
      ev.point = this.targetCenterWorld;
      ev.coordsFrom = CoordSource.Precision; // don't want raw point used...
    }

    IModelApp.toolAdmin.processWheelEvent(ev, false);
    return EventHandled.Yes;
  }

  public async startHandleDrag(ev: BeButtonEvent, forcedHandle?: ViewHandleType): Promise<EventHandled> {
    if (this.inHandleModify)
      return EventHandled.No; // If already changing the view reject the request...

    if (undefined !== forcedHandle) {
      if (!this.viewHandles.hasHandle(forcedHandle))
        return EventHandled.No; // If requested handle isn't present reject the request...
      this._forcedHandle = forcedHandle;
    }

    this.receivedDownEvent = true; // Request up events even though we may not have gotten the down event...
    this.isDragging = true;

    if (0 === this.nPts)
      this.onDataButtonDown(ev);

    return EventHandled.Yes;
  }

  public async onMouseStartDrag(ev: BeButtonEvent): Promise<EventHandled> {
    switch (ev.button) {
      case BeButton.Reset:
        return EventHandled.No;
      case BeButton.Middle:
        if (!this.viewHandles.hasHandle(ViewHandleType.Walk) && !this.viewHandles.hasHandle(ViewHandleType.Fly)) // Allow middle drag to override IdleTool for walk/fly...
          return EventHandled.No;
    }
    return this.startHandleDrag(ev);
  }

  public async onMouseEndDrag(ev: BeButtonEvent): Promise<EventHandled> {
    // NOTE: To support startHandleDrag being called by IdleTool for middle button drag, check inHandleModify and not the button type...
    if (!this.inHandleModify)
      return EventHandled.No;

    this.isDragging = false;

    if (0 === this.nPts)
      return EventHandled.Yes;

    return this.onDataButtonDown(ev);
  }

  public async onMouseMotion(ev: BeButtonEvent) {
    this.stoppedOverHandle = false;
    if (0 === this.nPts && this.viewHandles.testHit(ev.viewPoint))
      this.viewHandles.focusHitHandle();

    if (0 !== this.nPts)
      this.processPoint(ev, true);

    this.viewHandles.motion(ev);
  }

  public async onMouseMotionStopped(ev: BeButtonEvent) {
    if (ev.viewport !== this.viewport)
      return;

    if (0 === this.nPts) {
      if (this.viewHandles.testHit(ev.viewPoint)) {
        this.stoppedOverHandle = true;
        this.viewHandles.focusHitHandle();
      } else if (this.stoppedOverHandle) {
        this.stoppedOverHandle = false;
        this.viewport!.invalidateDecorations();
      }
    }
  }

  public async onMouseNoMotion(ev: BeButtonEvent) {
    if (0 === this.nPts || !ev.viewport)
      return;

    const hitHandle = this.viewHandles.hitHandle;
    if (hitHandle)
      hitHandle.noMotion(ev);
  }

  public onPostInstall(): void {
    super.onPostInstall();
    this.onReinitialize(); // Call onReinitialize now that tool is installed.
  }

  public onCleanup(): void {
    let restorePrevious = false;

    if (this.inDynamicUpdate) {
      this.endDynamicUpdate();
      restorePrevious = true;
    }

    const vp = this.viewport;
    if (undefined !== vp) {
      vp.synchWithView(true);

      if (restorePrevious)
        vp.doUndo(ToolSettings.animationTime);

      vp.invalidateDecorations();
    }
    this.viewHandles.empty();
    this.viewport = undefined;
  }

  public frustumDidNotChange(): boolean {
    const frust = this.viewport!.getWorldFrustum();
    if (this.frustumValid && frust.equals(this.lastFrustum))
      return true;

    this.lastFrustum.setFrom(frust);
    this.frustumValid = true;
    return false;
  }

  public updateTargetCenter(): void {
    const vp = this.viewport;
    if (!vp)
      return;

    if (this.targetCenterValid) {
      if (this.inHandleModify)
        return;
      if (IModelApp.tentativePoint.isActive) {
        this.setTargetCenterWorld(IModelApp.tentativePoint.getPoint(), true, false);
        IModelApp.tentativePoint.clear(true); // Clear tentative, there won't be a datapoint to accept...
      }
      return;
    }

    if (IModelApp.tentativePoint.isActive)
      return this.setTargetCenterWorld(IModelApp.tentativePoint.getPoint(), true, false);

    if (TentativeOrAccuSnap.isHot)
      return this.setTargetCenterWorld(TentativeOrAccuSnap.getCurrentPoint(), true, false);

    if (vp.viewCmdTargetCenter && this.isPointVisible(vp.viewCmdTargetCenter))
      return this.setTargetCenterWorld(vp.viewCmdTargetCenter, true, true);

    if (!vp.view.allow3dManipulations()) {
      const defaultPoint = vp.npcToWorld(NpcCenter); defaultPoint.z = 0.0;
      return this.setTargetCenterWorld(defaultPoint, false, false);
    }

    const visiblePoint = vp.pickNearestVisibleGeometry(vp.npcToWorld(NpcCenter), vp.pixelsFromInches(ToolSettings.viewToolPickRadiusInches));
    this.setTargetCenterWorld(undefined !== visiblePoint ? visiblePoint : vp.view.getTargetPoint(), false, false);
  }

  public processFirstPoint(ev: BeButtonEvent) {
    const forcedHandle = this._forcedHandle;
    this._forcedHandle = ViewHandleType.None;
    this.frustumValid = false;

    if (this.viewHandles.testHit(ev.viewPoint, forcedHandle)) {
      this.inHandleModify = true;
      this.viewHandles.focusHitHandle();
      const handle = this.viewHandles.hitHandle;
      if (undefined !== handle && !handle.firstPoint(ev))
        return false;
    }

    return true;
  }

  public processPoint(ev: BeButtonEvent, inDynamics: boolean) {
    const hitHandle = this.viewHandles.hitHandle;
    if (undefined === hitHandle)
      return true;

    const doUpdate = hitHandle.doManipulation(ev, inDynamics);
    return inDynamics || (doUpdate && hitHandle.checkOneShot());
  }

  public lensAngleMatches(angle: Angle, tolerance: number) {
    const cameraView = this.viewport!.view;
    return !cameraView.is3d() ? false : Math.abs(cameraView.calcLensAngle().radians - angle.radians) < tolerance;
  }

  public get isZUp() {
    const view = this.viewport!.view;
    const viewX = view.getXVector();
    const viewY = view.getXVector();
    const zVec = Vector3d.unitZ();
    return (Math.abs(zVec.dotProduct(viewY)) > 0.99 && Math.abs(zVec.dotProduct(viewX)) < 0.01);
  }

  public static getFocusPlaneNpc(vp: Viewport): number {
    const pt = vp.view.getTargetPoint();
    if (pt.z < 0.0 || pt.z > 1.0) {
      pt.set(0.5, 0.5, 0.0);
      const pt2 = new Point3d(0.5, 0.5, 1.0);
      vp.npcToWorld(pt, pt);
      vp.npcToWorld(pt2, pt2);
      pt.interpolate(0.5, pt2, pt);
      vp.worldToNpc(pt, pt);
    }

    return pt.z;
  }

  /**
   * Set the target point for viewing operations.
   * @param pt the new target point in world coordinates
   * @param lockTarget consider the target point locked for this tool instance
   * @param saveTarget save this target point for use between tool instances
   */
  public setTargetCenterWorld(pt: Point3d, lockTarget: boolean, saveTarget: boolean) {
    this.targetCenterWorld.setFrom(pt);
    this.targetCenterValid = true;
    this.targetCenterLocked = lockTarget;

    if (!this.viewport)
      return;

    if (!this.viewport.view.allow3dManipulations())
      this.targetCenterWorld.z = 0.0;

    this.viewport.viewCmdTargetCenter = (saveTarget ? pt : undefined);
  }

  /** Determine whether the supplied point is visible in this Viewport. */
  public isPointVisible(testPt: Point3d): boolean {
    const vp = this.viewport;
    if (!vp)
      return false;
    const testPtView = vp.worldToView(testPt);
    const frustum = vp.getFrustum(CoordSystem.View, false);

    const screenRange = Point3d.create(
      frustum.points[Npc._000].distance(frustum.points[Npc._100]),
      frustum.points[Npc._000].distance(frustum.points[Npc._010]),
      frustum.points[Npc._000].distance(frustum.points[Npc._001]));

    return (!((testPtView.x < 0 || testPtView.x > screenRange.x) || (testPtView.y < 0 || testPtView.y > screenRange.y)));
  }

  protected static _useViewAlignedVolume: boolean = false;
  public static fitView(viewport: Viewport, doAnimate: boolean, marginPercent?: MarginPercent) {
    const range = viewport.computeViewRange();
    const aspect = viewport.viewRect.aspect;
    const before = viewport.getWorldFrustum();

    if (this._useViewAlignedVolume)
      viewport.view.lookAtViewAlignedVolume(range, aspect, marginPercent);
    else
      viewport.view.lookAtVolume(range, aspect, marginPercent);

    viewport.synchWithView(false);
    viewport.viewCmdTargetCenter = undefined;
    if (doAnimate)
      viewport.animateFrustumChange(before, viewport.getFrustum());

    viewport.synchWithView(true);
  }

  public setCameraLensAngle(lensAngle: Angle, retainEyePoint: boolean): ViewStatus {
    const vp = this.viewport;
    if (!vp)
      return ViewStatus.InvalidViewport;

    const view = vp.view;
    if (!view || !view.is3d() || !view.allow3dManipulations())
      return ViewStatus.InvalidViewport;

    const result = (retainEyePoint && view.isCameraOn) ?
      view.lookAtUsingLensAngle(view.getEyePoint(), view.getTargetPoint(), view.getYVector(), lensAngle) :
      vp.turnCameraOn(lensAngle);

    if (result !== ViewStatus.Success)
      return result;

    vp.synchWithView(false);

    if (!this.targetCenterLocked) {
      this.targetCenterValid = false;
      this.updateTargetCenter(); // Update default rotate point for when the camera needed to be turned on...
    }

    return ViewStatus.Success;
  }

  public enforceZUp(pivotPoint: Point3d) {
    const vp = this.viewport;
    if (!vp || this.isZUp)
      return false;

    const view = vp.view;
    const viewY = view.getYVector();
    const rotMatrix = RotMatrix.createRotationVectorToVector(viewY, Vector3d.unitZ());
    if (!rotMatrix)
      return false;

    const transform = Transform.createFixedPointAndMatrix(pivotPoint, rotMatrix);
    const frust = vp.getWorldFrustum();
    frust.multiply(transform);
    vp.setupViewFromFrustum(frust);
    return true;
  }

  public changeViewport(vp: Viewport | undefined): void {
    // If viewport isn't really changing do nothing...
    if (vp === this.viewport)
      return;

    if (undefined !== this.viewport) {
      this.viewport.invalidateDecorations(); // Remove decorations from current viewport...
      this.viewHandles.empty();
    }

    // Set m_viewport to new viewport and return if new viewport is undefined...
    if (undefined === (this.viewport = vp))
      return;

    // allocate and initialize handles array
    this.viewHandles.viewport = vp;
    this.targetCenterValid = false;
    this.updateTargetCenter();

    if (this.handleMask & ViewHandleType.Rotate)
      this.viewHandles.add(new ViewRotate(this));

    if (this.handleMask & ViewHandleType.TargetCenter)
      this.viewHandles.add(new ViewTargetCenter(this));

    if (this.handleMask & ViewHandleType.Pan)
      this.viewHandles.add(new ViewPan(this));

    if (this.handleMask & ViewHandleType.Scroll)
      this.viewHandles.add(new ViewScroll(this));

    if (this.handleMask & ViewHandleType.Zoom)
      this.viewHandles.add(new ViewZoom(this));

    if (this.handleMask & ViewHandleType.Walk)
      this.viewHandles.add(new ViewWalk(this));

    if (this.handleMask & ViewHandleType.Fly)
      this.viewHandles.add(new ViewFly(this));

    if (this.handleMask & ViewHandleType.Look)
      this.viewHandles.add(new ViewLook(this));
  }
}

/** ViewingToolHandle for modifying the view's target point for operations like rotate */
class ViewTargetCenter extends ViewingToolHandle {
  public get handleType() { return ViewHandleType.TargetCenter; }
  public checkOneShot(): boolean { return false; } // Don't exit tool after moving target in single-shot mode...

  public firstPoint(ev: BeButtonEvent) {
    if (!ev.viewport)
      return false;
    IModelApp.accuSnap.enableSnap(true);
    return true;
  }

  public testHandleForHit(ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    if (this.viewTool.isDraggingRequired)
      return false; // Target center handle is not movable in this mode, but it's still nice to display the point we're rotating about...

    const targetPt = this.viewTool.viewport!.worldToView(this.viewTool.targetCenterWorld);
    const distance = targetPt.distanceXY(ptScreen);
    const locateThreshold = this.viewTool.viewport!.pixelsFromInches(0.15);

    if (distance > locateThreshold)
      return false;

    out.distance = distance;
    out.priority = ViewManipPriority.High;
    return true;
  }

  public addCross(graphic: GraphicBuilder, size: number, x: number, y: number): void {
    const lineHorzPts = [new Point2d(), new Point2d()];
    const lineVertPts = [new Point2d(), new Point2d()];

    lineHorzPts[0].x = x - size;
    lineHorzPts[0].y = y;
    lineHorzPts[1].x = x + size;
    lineHorzPts[1].y = y;
    lineVertPts[0].x = x;
    lineVertPts[0].y = y - size;
    lineVertPts[1].x = x;
    lineVertPts[1].y = y + size;

    graphic.addLineString2d(lineHorzPts, 0.0);
    graphic.addLineString2d(lineVertPts, 0.0);
  }

  public drawHandle(context: DecorateContext, hasFocus: boolean): void {
    if (context.viewport !== this.viewTool.viewport)
      return;

    let sizeInches = 0.2;
    if (!hasFocus && this.viewTool.inHandleModify) {
      sizeInches = 0.1; // Display small target when dragging...
      hasFocus = false;
    }

    const targetPt = this.viewTool.viewport!.worldToView(this.viewTool.targetCenterWorld);
    const pixelSize = context.viewport.pixelsFromInches(sizeInches);
    const graphic = context.createViewOverlay();

    const shadow = ColorDef.from(0, 0, 0, 225);
    graphic.setSymbology(shadow, shadow, hasFocus ? 9 : 6);
    this.addCross(graphic, pixelSize + 2, targetPt.x + 1, targetPt.y + 1);

    const outline = ColorDef.from(0, 0, 0, 10);
    graphic.setSymbology(outline, outline, hasFocus ? 5 : 3);
    this.addCross(graphic, pixelSize + 1, targetPt.x, targetPt.y);

    const cross = ColorDef.from(254, 255, 255, 10);
    graphic.setSymbology(cross, cross, hasFocus ? 3 : 1);
    this.addCross(graphic, pixelSize, targetPt.x, targetPt.y);

    context.addViewOverlay(graphic.finish());
  }

  public doManipulation(ev: BeButtonEvent, inDynamics: boolean) {
    if (ev.viewport !== this.viewTool.viewport)
      return false;

    this.viewTool.setTargetCenterWorld(ev.point, !inDynamics, !inDynamics);
    ev.viewport!.invalidateDecorations();

    if (!inDynamics)
      IModelApp.accuSnap.enableSnap(false);

    return false; // false means don't do screen update
  }
}

/** ViewingToolHandle for performing the "pan view" operation */
class ViewPan extends ViewingToolHandle {
  private _anchorPt: Point3d = new Point3d();
  private _lastPtNpc: Point3d = new Point3d();
  public get handleType() { return ViewHandleType.Pan; }
  public getHandleCursor() { return this.viewTool.inHandleModify ? BeCursor.ClosedHand : BeCursor.OpenHand; }

  public doManipulation(ev: BeButtonEvent, _inDynamics: boolean) {
    const vp = ev.viewport!;
    const newPtWorld = ev.point.clone();
    const thisPtNpc = vp.worldToNpc(newPtWorld);
    const firstPtNpc = vp.worldToNpc(this._anchorPt);

    thisPtNpc.z = firstPtNpc.z;

    if (this._lastPtNpc.isAlmostEqual(thisPtNpc, 1.0e-10))
      return true;

    vp.npcToWorld(thisPtNpc, newPtWorld);
    this._lastPtNpc.setFrom(thisPtNpc);
    return this.doPan(newPtWorld);
  }

  public firstPoint(ev: BeButtonEvent) {
    const vp = ev.viewport!;
    this._anchorPt.setFrom(ev.rawPoint);

    // if the camera is on, we need to find the element under the starting point to get the z
    if (CoordSource.User === ev.coordsFrom && vp.isCameraOn) {
      const visiblePoint = vp.pickNearestVisibleGeometry(this._anchorPt, vp.pixelsFromInches(ToolSettings.viewToolPickRadiusInches));
      if (undefined !== visiblePoint) {
        this._anchorPt.setFrom(visiblePoint);
      } else {
        const firstPtNpc = vp.worldToNpc(this._anchorPt);
        firstPtNpc.z = ViewManip.getFocusPlaneNpc(vp);
        this._anchorPt = vp.npcToWorld(firstPtNpc, this._anchorPt);
      }
    }

    this.viewTool.beginDynamicUpdate();
    return true;
  }

  public onReinitialize() {
    const vha = this.viewTool.viewHandles.hitHandle;
    if (vha === this) {
      IModelApp.toolAdmin.setCursor(this.getHandleCursor());
    }
  }

  public testHandleForHit(_ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    out.distance = 0.0;
    out.priority = ViewManipPriority.Low;
    return true;
  }

  public doPan(newPtWorld: Point3d) {
    const vp = this.viewTool.viewport!;
    const view = vp.view;
    const dist = newPtWorld.vectorTo(this._anchorPt);

    if (view.is3d()) {
      if (ViewStatus.Success !== view.moveCameraWorld(dist))
        return false;
    } else {
      view.setOrigin(view.getOrigin().plus(dist));
    }

    vp.synchWithView(false);
    return true;
  }
}

/** ViewingToolHandle for performing the "rotate view" operation */
class ViewRotate extends ViewingToolHandle {
  private _lastPtNpc = new Point3d();
  private _firstPtNpc = new Point3d();
  private _frustum = new Frustum();
  private _activeFrustum = new Frustum();
  public get handleType() { return ViewHandleType.Rotate; }
  public getHandleCursor() { return BeCursor.Rotate; }

  public testHandleForHit(ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    const targetPt = this.viewTool.viewport!.worldToView(this.viewTool.targetCenterWorld);
    out.distance = targetPt.distanceXY(ptScreen);
    out.priority = ViewManipPriority.Normal;
    return true;
  }

  public firstPoint(ev: BeButtonEvent) {
    const tool = this.viewTool;
    const vp = ev.viewport!;

    if (!tool.targetCenterLocked && vp.view.allow3dManipulations()) {
      const visiblePoint = vp.pickNearestVisibleGeometry(ev.rawPoint, vp.pixelsFromInches(ToolSettings.viewToolPickRadiusInches));
      if (undefined !== visiblePoint)
        tool.setTargetCenterWorld(visiblePoint, false, false);
    }

    const pickPt = ev.rawPoint.clone();
    const pickPtOrig = pickPt.clone();

    vp.worldToNpc(pickPtOrig, this._firstPtNpc);
    this._lastPtNpc.setFrom(this._firstPtNpc);

    vp.getWorldFrustum(this._activeFrustum);
    this._frustum.setFrom(this._activeFrustum);

    tool.beginDynamicUpdate();
    return true;
  }

  public doManipulation(ev: BeButtonEvent, _inDynamics: boolean): boolean {
    const tool = this.viewTool;
    const viewport = tool.viewport!;
    const ptNpc = viewport.worldToNpc(ev.point);
    if (this._lastPtNpc.isAlmostEqual(ptNpc, 1.0e-10)) // no movement since last point
      return true;

    if (this._firstPtNpc.isAlmostEqual(ptNpc, 1.0e-2)) // too close to anchor pt
      ptNpc.setFrom(this._firstPtNpc);

    this._lastPtNpc.setFrom(ptNpc);
    const currentFrustum = viewport.getWorldFrustum();
    const frustumChange = !currentFrustum.equals(this._activeFrustum);
    if (frustumChange)
      this._frustum.setFrom(currentFrustum);
    else if (!viewport.setupViewFromFrustum(this._frustum))
      return false;

    const currPt = viewport.npcToView(ptNpc);
    if (frustumChange)
      this._firstPtNpc.setFrom(ptNpc);

    let radians: Angle;
    let worldAxis: Vector3d;
    const worldPt = tool.targetCenterWorld;
    if (!viewport.view.allow3dManipulations()) {
      const centerPt = viewport.worldToView(worldPt);
      const firstPt = viewport.npcToView(this._firstPtNpc);
      const vector0 = Vector2d.createStartEnd(centerPt, firstPt);
      const vector1 = Vector2d.createStartEnd(centerPt, currPt);
      radians = vector0.angleTo(vector1);
      worldAxis = Vector3d.unitZ();
    } else {
      const viewRect = viewport.viewRect;
      const xExtent = viewRect.width;
      const yExtent = viewRect.height;

      viewport.npcToView(ptNpc, currPt);
      const firstPt = viewport.npcToView(this._firstPtNpc);

      const xDelta = (currPt.x - firstPt.x);
      const yDelta = (currPt.y - firstPt.y);

      // Movement in screen x == rotation about drawing Z (preserve up) or rotation about screen  Y...
      const xAxis = ToolSettings.preserveWorldUp ? Vector3d.unitZ() : viewport.rotMatrix.getRow(1);

      // Movement in screen y == rotation about screen X...
      const yAxis = viewport.rotMatrix.getRow(0);

      const xRMatrix = xDelta ? RotMatrix.createRotationAroundVector(xAxis, Angle.createRadians(Math.PI / (xExtent / xDelta)))! : RotMatrix.createIdentity();
      const yRMatrix = yDelta ? RotMatrix.createRotationAroundVector(yAxis, Angle.createRadians(Math.PI / (yExtent / yDelta)))! : RotMatrix.createIdentity();
      const worldRMatrix = yRMatrix.multiplyMatrixMatrix(xRMatrix);
      const result = worldRMatrix.getAxisAndAngleOfRotation();
      radians = Angle.createRadians(-result.angle.radians);
      worldAxis = result.axis;
    }

    this.rotateViewWorld(worldPt, worldAxis, radians);
    viewport.getWorldFrustum(this._activeFrustum);

    return true;
  }

  private rotateViewWorld(worldOrigin: Point3d, worldAxisVector: Vector3d, primaryAngle: Angle) {
    const worldMatrix = RotMatrix.createRotationAroundVector(worldAxisVector, primaryAngle);
    if (!worldMatrix)
      return;
    const worldTransform = Transform.createFixedPointAndMatrix(worldOrigin, worldMatrix!);
    const frustum = this._frustum.transformBy(worldTransform);
    this.viewTool.viewport!.setupViewFromFrustum(frustum);
  }
}

/** ViewingToolHandle for performing the "look view" operation */
class ViewLook extends ViewingToolHandle {
  private _eyePoint = new Point3d();
  private _firstPtView = new Point3d();
  private _rotation = new RotMatrix();
  private _frustum = new Frustum();
  public get handleType() { return ViewHandleType.Look; }
  public getHandleCursor(): BeCursor { return BeCursor.CrossHair; }

  public testHandleForHit(_ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    out.distance = 0.0;
    out.priority = ViewManipPriority.Low;
    return true;
  }

  public firstPoint(ev: BeButtonEvent) {
    const tool = this.viewTool;
    const vp = ev.viewport!;
    const view = vp.view;
    if (!view || !view.is3d() || !view.allow3dManipulations())
      return false;

    this._firstPtView.setFrom(ev.viewPoint);
    this._eyePoint.setFrom(view.getEyePoint());
    this._rotation.setFrom(vp.rotMatrix);

    vp.getWorldFrustum(this._frustum);
    tool.beginDynamicUpdate();
    return true;
  }

  public doManipulation(ev: BeButtonEvent, _inDynamics: boolean): boolean {
    const tool = this.viewTool;
    const viewport = tool.viewport!;

    if (ev.viewport !== viewport)
      return false;

    const worldTransform = this.getLookTransform(viewport, this._firstPtView, ev.viewPoint);
    const frustum = this._frustum.transformBy(worldTransform);
    this.viewTool.viewport!.setupViewFromFrustum(frustum);

    return true;
  }

  private getLookTransform(vp: Viewport, firstPt: Point3d, currPt: Point3d): Transform {
    const viewRect = vp.viewRect;
    const xExtent = viewRect.width;
    const yExtent = viewRect.height;
    const xDelta = (currPt.x - firstPt.x);
    const yDelta = (currPt.y - firstPt.y);
    const xAngle = -(xDelta / xExtent) * Math.PI;
    const yAngle = -(yDelta / yExtent) * Math.PI;

    const inverseRotation = this._rotation.inverse();
    const horizontalRotation = RotMatrix.createRotationAroundVector(Vector3d.unitZ(), Angle.createRadians(xAngle));
    const verticalRotation = RotMatrix.createRotationAroundVector(Vector3d.unitX(), Angle.createRadians(yAngle));

    if (undefined === inverseRotation || undefined === horizontalRotation || undefined === verticalRotation)
      return Transform.createIdentity();

    verticalRotation.multiplyMatrixMatrix(this._rotation, verticalRotation);
    inverseRotation.multiplyMatrixMatrix(verticalRotation, verticalRotation);

    const newRotation = horizontalRotation.multiplyMatrixMatrix(verticalRotation);
    const transform = Transform.createFixedPointAndMatrix(this._eyePoint, newRotation);
    return transform;
  }
}

/** ViewingToolHandle for performing the "scroll view" operation */
class ViewScroll extends ViewingToolHandle {
  private _anchorPtView = new Point3d();
  private _lastPtView = new Point3d();
  public get handleType() { return ViewHandleType.Scroll; }
  public getHandleCursor(): BeCursor { return BeCursor.CrossHair; }

  public testHandleForHit(_ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    out.distance = 0.0;
    out.priority = ViewManipPriority.Low;
    return true;
  }

  public drawHandle(context: DecorateContext, _hasFocus: boolean): void {
    if (context.viewport !== this.viewTool.viewport || !this.viewTool.inDynamicUpdate)
      return;

    const black = ColorDef.black.clone();
    const white = ColorDef.white.clone(); white.setAlpha(100);
    const green = ColorDef.green.clone(); green.setAlpha(200);
    const graphic = context.createViewOverlay();

    const points = [new Point2d(this._anchorPtView.x, this._anchorPtView.y), new Point2d(this._lastPtView.x, this._lastPtView.y)];
    graphic.setSymbology(green, green, 2);
    graphic.addLineString2d(points, 0.0);

    const radius = context.viewport.pixelsFromInches(0.15);
    const ellipse = Arc3d.createXYEllipse(this._anchorPtView, radius, radius);
    graphic.setBlankingFill(white);
    graphic.addArc(ellipse, true, true);
    graphic.setSymbology(black, black, 1);
    graphic.addArc(ellipse, false, false);

    const dvec = Vector2d.createStartEnd(points[0], points[1]);
    if (dvec.magnitude() > 0.1) {
      const slashPts = [new Point2d(), new Point2d()];
      dvec.normalize(dvec);
      points[0].plusScaled(dvec, radius, slashPts[0]);
      points[0].plusScaled(dvec, -radius, slashPts[1]);
      graphic.setSymbology(black, black, 2);
      graphic.addLineString2d(slashPts, 0.0);
    }

    context.addViewOverlay(graphic.finish());
  }

  public firstPoint(ev: BeButtonEvent) {
    const tool = this.viewTool;
    this._anchorPtView.setFrom(ev.viewPoint);
    this._lastPtView.setFrom(ev.viewPoint);
    tool.beginDynamicUpdate();
    return true;
  }

  public doManipulation(ev: BeButtonEvent, _inDynamics: boolean): boolean {
    const tool = this.viewTool;
    const viewport = tool.viewport!;

    if (ev.viewport !== viewport)
      return false;

    return this.doScroll(ev);
  }

  public noMotion(ev: BeButtonEvent): boolean {
    if (ev.viewport !== this.viewTool.viewport)
      return false;

    this.viewTool.beginDynamicUpdate();
    this.doScroll(ev);
    return false;
  }

  public doScroll(ev: BeButtonEvent): boolean {
    this._lastPtView.setFrom(ev.viewPoint);
    // if we're resting near the anchor point, don't bother with this
    if ((Math.abs(this._anchorPtView.x - this._lastPtView.x) < 5.0) && Math.abs(this._anchorPtView.y - this._lastPtView.y) < 5.0)
      return false;

    const scrollFactor = (-1.0 / 8.5);
    const dist = this._anchorPtView.minus(this._lastPtView); dist.z = 0.0;
    const viewport = ev.viewport!;
    const view = viewport.view;

    if (view.is3d() && view.isCameraOn) {
      const points: Point3d[] = new Array<Point3d>(2);
      points[0] = this._anchorPtView.clone();
      points[1] = points[0].plusScaled(dist, scrollFactor);

      viewport.viewToNpcArray(points);
      points[0].z = points[1].z = ViewManip.getFocusPlaneNpc(viewport); // use the focal plane for z coordinates
      viewport.npcToWorldArray(points);

      const offset = points[1].minus(points[0]);
      const offsetTransform = Transform.createTranslation(offset);

      const frustum = viewport.getWorldFrustum();
      frustum.transformBy(offsetTransform, frustum);
      viewport.setupViewFromFrustum(frustum);
    } else {
      const iDist = Point2d.create(Math.floor(dist.x * scrollFactor), Math.floor(dist.y * scrollFactor));
      viewport.scroll(iDist);
    }

    return true;
  }
}

/** ViewingToolHandle for performing the "zoom view" operation */
class ViewZoom extends ViewingToolHandle {
  private _anchorPtView = new Point3d();
  private _anchorPtNpc = new Point3d();
  private _lastPtView = new Point3d();
  private _lastZoomRatio = 1.0;
  public get handleType() { return ViewHandleType.Zoom; }
  public getHandleCursor(): BeCursor { return BeCursor.CrossHair; }

  public testHandleForHit(_ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    out.distance = 0.0;
    out.priority = ViewManipPriority.Low;
    return true;
  }

  public drawHandle(context: DecorateContext, _hasFocus: boolean): void {
    if (context.viewport !== this.viewTool.viewport || !this.viewTool.inDynamicUpdate)
      return;

    const black = ColorDef.black.clone();
    const white = ColorDef.white.clone(); white.setAlpha(100);
    const radius = context.viewport.pixelsFromInches(0.15);
    const plusMinus = context.viewport.pixelsFromInches(0.075);
    const graphic = context.createViewOverlay();

    const ellipse = Arc3d.createXYEllipse(this._anchorPtView, radius, radius);
    graphic.setBlankingFill(white);
    graphic.addArc(ellipse, true, true);
    graphic.setSymbology(black, black, 1);
    graphic.addArc(ellipse, false, false);

    const lineHorzPts = [new Point2d(), new Point2d()];
    lineHorzPts[0].x = this._anchorPtView.x - plusMinus;
    lineHorzPts[0].y = this._anchorPtView.y;
    lineHorzPts[1].x = this._anchorPtView.x + plusMinus;
    lineHorzPts[1].y = this._anchorPtView.y;
    graphic.setSymbology(black, black, 2);
    graphic.addLineString2d(lineHorzPts, 0.0);

    if (this._lastZoomRatio < 1.0) {
      const lineVertPts = [new Point2d(), new Point2d()];
      lineVertPts[0].x = this._anchorPtView.x;
      lineVertPts[0].y = this._anchorPtView.y - plusMinus;
      lineVertPts[1].x = this._anchorPtView.x;
      lineVertPts[1].y = this._anchorPtView.y + plusMinus;
      graphic.addLineString2d(lineVertPts, 0.0);
    }

    context.addViewOverlay(graphic.finish());
  }

  public firstPoint(ev: BeButtonEvent) {
    const tool = this.viewTool;
    const viewport = tool.viewport!;
    const view = viewport.view;
    if (view.is3d() && view.isCameraOn) {
      const visiblePoint = viewport.pickNearestVisibleGeometry(CoordSource.User === ev.coordsFrom ? ev.rawPoint : ev.point, viewport.pixelsFromInches(ToolSettings.viewToolPickRadiusInches));
      if (undefined !== visiblePoint) {
        this._anchorPtView.setFrom(visiblePoint);
        viewport.worldToView(this._anchorPtView, this._anchorPtView);
        this._lastPtView.setFrom(this._anchorPtView);
        tool.viewport!.viewToNpc(this._anchorPtView, this._anchorPtNpc);
        tool.beginDynamicUpdate();
        return true;
      }
    }

    if (CoordSource.User === ev.coordsFrom)
      this._anchorPtView.setFrom(ev.viewPoint);
    else
      viewport.worldToView(ev.point, this._anchorPtView);
    this._lastPtView.setFrom(this._anchorPtView);
    tool.viewport!.viewToNpc(this._anchorPtView, this._anchorPtNpc);
    tool.beginDynamicUpdate();
    return true;
  }

  public doManipulation(ev: BeButtonEvent, _inDynamics: boolean): boolean {
    if (ev.viewport !== this.viewTool.viewport)
      return false;

    return this.doZoom(ev);
  }

  public noMotion(ev: BeButtonEvent): boolean {
    if (ev.viewport !== this.viewTool.viewport)
      return false;

    this.viewTool.beginDynamicUpdate();
    this.doZoom(ev);
    return false;
  }

  public doZoom(ev: BeButtonEvent): boolean {
    this._lastPtView.setFrom(ev.viewPoint);
    // if we're resting near the anchor point, don't bother with this
    if ((Math.abs(this._anchorPtView.x - this._lastPtView.x) < 5.0) && Math.abs(this._anchorPtView.y - this._lastPtView.y) < 5.0)
      return false;

    const viewport = ev.viewport!;
    const view = viewport.view;

    const thisPtNpc = viewport.viewToNpc(this._lastPtView);
    const dist = this._anchorPtNpc.minus(thisPtNpc); dist.z = 0.0;
    const zoomFactor = 0.35;
    let zoomRatio = 1.0 + (dist.magnitude() * zoomFactor);

    if (dist.y < 0)
      zoomRatio = 1.0 / zoomRatio;

    this._lastZoomRatio = zoomRatio;

    if (view.is3d() && view.isCameraOn) {
      const anchorPtWorld = viewport.npcToWorld(this._anchorPtNpc);

      const transform = Transform.createFixedPointAndMatrix(anchorPtWorld, RotMatrix.createScale(zoomRatio, zoomRatio, zoomRatio));
      const oldEyePoint = view.getEyePoint();
      const newEyePoint = transform.multiplyPoint3d(oldEyePoint);
      const cameraOffset = newEyePoint.minus(oldEyePoint);
      const cameraOffsetTransform = Transform.createTranslation(cameraOffset);
      const frustum = viewport.getWorldFrustum();
      frustum.transformBy(cameraOffsetTransform, frustum);
      viewport.setupViewFromFrustum(frustum);
    } else {
      const transform = Transform.createFixedPointAndMatrix(this._anchorPtNpc, RotMatrix.createScale(zoomRatio, zoomRatio, 1.0));
      const frustum = viewport.getFrustum(CoordSystem.Npc, true);
      frustum.transformBy(transform, frustum);
      viewport.npcToWorldArray(frustum.points);
      viewport.setupViewFromFrustum(frustum);
    }
    return true;
  }
}

/** @hidden */
class NavigateMotion {
  public deltaTime = 0;
  public transform = Transform.createIdentity();
  constructor(public viewport: Viewport) { }

  public init(elapsedMilliseconds: number) {
    this.deltaTime = elapsedMilliseconds * 0.001;
    this.transform.setIdentity();
  }

  public getViewUp(result?: Vector3d) { return this.viewport.rotMatrix.getRow(1, result); }

  public getViewDirection(result?: Vector3d): Vector3d {
    const forward = this.viewport.rotMatrix.getRow(2, result);
    forward.scale(-1, forward); // positive z is out of the screen, but we want direction into the screen
    return forward;
  }

  public takeElevator(distance: number): void {
    const trans = Point3d.create(0, 0, distance * this.deltaTime);
    Transform.createTranslation(trans, this.transform);
  }

  public modifyPitchAngleToPreventInversion(pitchAngle: number): number {
    const angleLimit = Angle.degreesToRadians(85);
    const angleTolerance = Angle.degreesToRadians(0.01);

    if (0.0 === pitchAngle)
      return 0.0;

    const viewUp = this.getViewUp();
    const viewDir = this.getViewDirection();
    const worldUp = Vector3d.unitZ();

    let viewAngle = worldUp.angleTo(viewUp).radians;
    if (viewDir.z < 0)
      viewAngle *= -1;

    let newAngle = pitchAngle + viewAngle;
    if (Math.abs(newAngle) < angleLimit)
      return pitchAngle; // not close to the limit
    if ((pitchAngle > 0) !== (viewAngle > 0) && (Math.abs(pitchAngle) < Math.PI / 2))
      return pitchAngle; // tilting away from the limit
    if (Math.abs(viewAngle) >= (angleLimit - angleTolerance))
      return 0.0; // at the limit already

    const difference = Math.abs(newAngle) - angleLimit;
    newAngle = (pitchAngle > 0) ? pitchAngle - difference : pitchAngle + difference;
    return newAngle; // almost at the limit, but still can go a little bit closer
  }

  public generateRotationTransform(yawRate: number, pitchRate: number, result?: Transform): Transform {
    const vp = this.viewport;
    const view = vp.view as ViewState3d;
    const viewRot = vp.rotMatrix;
    const invViewRot = viewRot.inverse()!;
    const pitchAngle = Angle.createRadians(this.modifyPitchAngleToPreventInversion(pitchRate * this.deltaTime));
    const pitchMatrix = RotMatrix.createRotationAroundVector(Vector3d.unitX(), pitchAngle)!;
    const pitchTimesView = pitchMatrix.multiplyMatrixMatrix(viewRot);
    const inverseViewTimesPitchTimesView = invViewRot.multiplyMatrixMatrix(pitchTimesView);
    const yawMatrix = RotMatrix.createRotationAroundVector(Vector3d.unitZ(), Angle.createRadians(yawRate * this.deltaTime))!;
    const yawTimesInverseViewTimesPitchTimesView = yawMatrix.multiplyMatrixMatrix(inverseViewTimesPitchTimesView);
    return Transform.createFixedPointAndMatrix(view.getEyePoint(), yawTimesInverseViewTimesPitchTimesView, result);
  }

  public generateTranslationTransform(velocity: Vector3d, isConstrainedToXY: boolean, result?: Transform) {
    const points: Point3d[] = new Array<Point3d>(3);
    points[0] = new Point3d(0, 0, 0);
    points[1] = new Point3d(1, 0, 0);
    points[2] = new Point3d(0, 1, 0);
    if (this.viewport.isCameraOn) {
      this.viewport.viewToNpcArray(points);
      points[0].z = points[1].z = points[2].z = ViewManip.getFocusPlaneNpc(this.viewport); // use the focal plane for z coordinates
      this.viewport.npcToViewArray(points);
    }
    this.viewport.viewToWorldArray(points);
    const xDir = Vector3d.createStartEnd(points[0], points[1]);
    xDir.normalizeInPlace();
    const yDir = Vector3d.createStartEnd(points[0], points[2]);
    yDir.normalizeInPlace();

    const zDir = this.getViewDirection();

    if (isConstrainedToXY) {
      const up = Vector3d.unitZ();
      const cross = up.crossProduct(zDir);
      cross.crossProduct(up, zDir);
      zDir.normalizeInPlace();
    }

    xDir.scale(velocity.x * this.deltaTime, xDir);
    yDir.scale(velocity.y * this.deltaTime, yDir);
    zDir.scale(velocity.z * this.deltaTime, zDir);

    xDir.plus(yDir, xDir).plus(zDir, xDir);
    return Transform.createTranslation(xDir, result);
  }

  protected moveAndLook(linearVelocity: Vector3d, angularVelocityX: number, angularVelocityY: number, isConstrainedToXY: boolean): void {
    const rotateTrans = this.generateRotationTransform(angularVelocityX, angularVelocityY);
    const dollyTrans = this.generateTranslationTransform(linearVelocity, isConstrainedToXY);
    this.transform.setMultiplyTransformTransform(rotateTrans, dollyTrans);
  }

  public pan(horizontalVelocity: number, verticalVelocity: number): void {
    const travel = new Vector3d(horizontalVelocity, verticalVelocity, 0);
    this.moveAndLook(travel, 0, 0, false);
  }

  public travel(yawRate: number, pitchRate: number, forwardVelocity: number, isConstrainedToXY: boolean): void {
    const travel = new Vector3d(0, 0, forwardVelocity);
    this.moveAndLook(travel, yawRate, pitchRate, isConstrainedToXY);
  }

  public look(yawRate: number, pitchRate: number): void { this.generateRotationTransform(yawRate, pitchRate, this.transform); }

  /** reset pitch of view to zero */
  public resetToLevel(): void {
    const view = this.viewport.view;
    if (!view.is3d() || !view.isCameraOn)
      return;
    const angles = YawPitchRollAngles.createFromRotMatrix(this.viewport.rotMatrix)!;
    angles.pitch.setRadians(0); // reset pitch to zero
    Transform.createFixedPointAndMatrix(view.getEyePoint(), angles.toRotMatrix(), this.transform);
  }
}

/** ViewingToolHandle for performing the "walk and fly view" operations */
abstract class ViewNavigate extends ViewingToolHandle {
  private _anchorPtView = new Point3d();
  private _lastPtView = new Point3d();
  private _initialized = false;
  private _lastMotionTime = 0;
  private _orientationValid = false;
  private _orientationTime = 0;
  private _orientationZ = new Vector3d();
  protected abstract getNavigateMotion(elapsedTime: number): NavigateMotion | undefined;

  constructor(viewManip: ViewManip) { super(viewManip); }

  private static _angleLimit = 0.075;
  private static _timeLimit = 500;
  private haveStaticOrientation(zVec: Vector3d, currentTime: number): boolean {
    if (!this._orientationValid || zVec.angleTo(this._orientationZ).radians > ViewNavigate._angleLimit || this._orientationZ.isAlmostZero()) {
      this._orientationValid = true;
      this._orientationTime = currentTime;
      this._orientationZ = zVec;
      return false;
    }
    return (currentTime - this._orientationTime) > ViewNavigate._timeLimit;
  }

  private tryOrientationEvent(_forward: Vector3d, _ev: BeButtonEvent): { eventsEnabled: boolean, result: OrientationResult } {
    return { eventsEnabled: false, result: OrientationResult.NoEvent };
  }

  private getElapsedTime(currentTime: number): number {
    let elapsedTime = currentTime - this._lastMotionTime;
    if (0 === this._lastMotionTime || elapsedTime < 0 || elapsedTime > 1000)
      elapsedTime = 100;
    return elapsedTime;
  }

  public getMaxLinearVelocity() { return ToolSettings.walkVelocity; }
  public getMaxAngularVelocity() { return Math.PI / 4; }
  public testHandleForHit(_ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    out.distance = 0.0;
    out.priority = ViewManipPriority.Low;
    return true;
  }

  public getInputVector(result?: Vector3d): Vector3d {
    const inputDeadZone = 5.0;
    const input = this._anchorPtView.vectorTo(this._lastPtView, result);
    const viewRect = this.viewTool.viewport!.viewRect;

    if (Math.abs(input.x) < inputDeadZone)
      input.x = 0;
    else
      input.x = 2 * input.x / viewRect.width;

    if (Math.abs(input.y) < inputDeadZone)
      input.y = 0;
    else
      input.y = 2 * input.y / viewRect.height;

    input.x = Math.min(input.x, 1);
    input.y = Math.min(input.y, 1);
    return input;
  }

  public getCenterPoint(result: Point3d): Point3d {
    const center = result ? result : new Point3d();
    center.setZero();

    const rect = this.viewTool.viewport!.viewRect;
    const width = rect.width;
    const height = rect.height;

    if (width > 0)
      center.x = width / 2;

    if (height > 0)
      center.y = height / 2;

    return center;
  }

  public getNavigateMode(): NavigateMode {
    const state = IModelApp.toolAdmin.currentInputState;
    if (state.isShiftDown || !this.viewTool.viewport!.isCameraOn)
      return NavigateMode.Pan;
    return state.isControlDown ? NavigateMode.Look : NavigateMode.Travel;
  }

  private static _scratchForward = new Vector3d();
  public doNavigate(ev: BeButtonEvent): boolean {
    const currentTime = Date.now();
    const forward = ViewNavigate._scratchForward;
    const orientationEvent = this.tryOrientationEvent(forward, ev);
    const orientationResult = orientationEvent.result;
    const elapsedTime = this.getElapsedTime(currentTime);

    this._lastMotionTime = currentTime;
    const vp = this.viewTool.viewport!;
    const motion = this.getNavigateMotion(elapsedTime);

    let haveNavigateEvent: boolean = !!motion;
    if (haveNavigateEvent) {
      const frust = vp.getWorldFrustum();
      frust.multiply(motion!.transform);
      if (!vp.setupViewFromFrustum(frust)) {
        haveNavigateEvent = false;
        if (OrientationResult.NoEvent === orientationResult)
          return false;
      }
      return true;
    }

    switch (orientationResult) {
      case OrientationResult.Disabled:
      case OrientationResult.NoEvent:
        return true;
      case OrientationResult.RejectedByController:
      case OrientationResult.Success:
        return this.haveStaticOrientation(forward, currentTime);
      default:
        return false;
    }
  }

  public doManipulation(ev: BeButtonEvent, inDynamics: boolean): boolean {
    if (!inDynamics)
      return true;
    else if (ev.viewport !== this.viewTool.viewport)
      return false;

    this._lastPtView.setFrom(ev.viewPoint);
    return this.doNavigate(ev);
  }

  public noMotion(ev: BeButtonEvent): boolean {
    if (ev.viewport !== this.viewTool.viewport)
      return false;

    this.viewTool.beginDynamicUpdate();
    this.doNavigate(ev);
    return false;
  }

  public onReinitialize(): void {
    if (this._initialized)
      return;

    this._initialized = true;
    const tool = this.viewTool;
    const vp = tool.viewport!;
    const view = vp.view;
    if (!view.allow3dManipulations())
      return;

    const startFrust = vp.getWorldFrustum();
    const walkAngle = ToolSettings.walkCameraAngle;
    if (!tool.lensAngleMatches(walkAngle, Angle.degreesToRadians(10)) || !tool.isZUp) {
      //  This turns on the camera if its not already on. It also assures the camera is centered. Obviously this is required if
      //  the camera is not on or the lens angle is not what we want. We also want to do it if Z will be
      //  adjusted because EnforceZUp swivels the camera around what GetTargetPoint returns. If the FocusDistance is not set to something
      //  reasonable the target point may be far beyond anything relevant.
      tool.setCameraLensAngle(walkAngle, tool.lensAngleMatches(walkAngle, Angle.degreesToRadians(45.)));
    }

    if (ToolSettings.walkEnforceZUp)
      this.viewTool.enforceZUp(view.getTargetPoint());

    const endFrust = vp.getWorldFrustum();
    if (!startFrust.equals(endFrust))
      vp.animateFrustumChange(startFrust, endFrust);

    this.getCenterPoint(this._anchorPtView);
  }

  public onCleanup(): void {
  }

  public firstPoint(ev: BeButtonEvent): boolean {
    // NB: In desktop apps we want to center the cursor in the view.
    // The browser doesn't support that, and it is more useful to be able to place the anchor point freely anyway.
    this.viewTool.beginDynamicUpdate();
    this._lastPtView.setFrom(ev.viewPoint);
    this._anchorPtView.setFrom(this._lastPtView);
    return true;
  }

  public getHandleCursor(): BeCursor { return BeCursor.CrossHair; }

  public drawHandle(context: DecorateContext, _hasFocus: boolean): void {
    if (context.viewport !== this.viewTool.viewport || !this.viewTool.inDynamicUpdate)
      return;

    const point = new Point2d(this._anchorPtView.x, this._anchorPtView.y);
    const points = [point];
    const black = ColorDef.black.clone();
    const white = ColorDef.white.clone();
    const graphic = context.createViewOverlay();

    graphic.setSymbology(black, black, 9);
    graphic.addPointString2d(points, 0.0);

    graphic.setSymbology(white, black, 5);
    graphic.addPointString2d(points, 0.0);

    context.addViewOverlay(graphic.finish());
  }
}

/** ViewingToolHandle for performing the "walk view" operation */
class ViewWalk extends ViewNavigate {
  private _navigateMotion: NavigateMotion;

  constructor(viewManip: ViewManip) {
    super(viewManip);
    this._navigateMotion = new NavigateMotion(this.viewTool.viewport!);
  }
  public get handleType(): ViewHandleType { return ViewHandleType.Walk; }

  protected getNavigateMotion(elapsedTime: number): NavigateMotion | undefined {
    const input = this.getInputVector();
    if (0 === input.x && 0 === input.y)
      return undefined;

    const motion = this._navigateMotion;
    motion.init(elapsedTime);

    switch (this.getNavigateMode()) {
      case NavigateMode.Pan:
        input.scale(this.getMaxLinearVelocity(), input);
        motion.pan(input.x, input.y);
        break;
      case NavigateMode.Look:
        input.scale(-this.getMaxAngularVelocity(), input);
        motion.look(input.x, input.y);
        break;
      case NavigateMode.Travel:
        motion.travel(-input.x * this.getMaxAngularVelocity(), 0, -input.y * this.getMaxLinearVelocity(), true);
        break;
    }

    return motion;
  }
}

/** ViewingToolHandle for performing the "fly view" operation */
class ViewFly extends ViewNavigate {
  private _navigateMotion: NavigateMotion;

  constructor(viewManip: ViewManip) {
    super(viewManip);
    this._navigateMotion = new NavigateMotion(this.viewTool.viewport!);
  }
  public get handleType(): ViewHandleType { return ViewHandleType.Fly; }

  protected getNavigateMotion(elapsedTime: number): NavigateMotion | undefined {
    const input = this.getInputVector();
    const motion = this._navigateMotion;
    motion.init(elapsedTime);

    switch (this.getNavigateMode()) {
      case NavigateMode.Pan:
        if (0 === input.x && 0 === input.y)
          return undefined;
        input.scale(this.getMaxLinearVelocity(), input);
        motion.pan(input.x, input.y);
        break;
      case NavigateMode.Look:
        if (0 === input.x && 0 === input.y)
          return undefined;
        input.scale(-this.getMaxAngularVelocity(), input);
        motion.look(input.x, input.y);
        break;
      case NavigateMode.Travel:
        input.scale(-this.getMaxAngularVelocity() * 2.0, input);
        motion.travel(input.x, input.y, this.getMaxLinearVelocity(), false);
        break;
    }

    return motion;
  }
}

/** The tool that performs a Pan view operation */
export class PanViewTool extends ViewManip {
  public static toolId = "View.Pan";
  constructor(vp: Viewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Pan, oneShot, isDraggingRequired);
  }
}

/** tool that performs a Rotate view operation */
export class RotateViewTool extends ViewManip {
  public static toolId = "View.Rotate";
  constructor(vp: Viewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Rotate | ViewHandleType.Pan | ViewHandleType.TargetCenter, oneShot, isDraggingRequired);
  }
}

/** tool that performs the look operation */
export class LookViewTool extends ViewManip {
  public static toolId = "View.Look";
  constructor(vp: Viewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Look, oneShot, isDraggingRequired);
  }
}

/** tool that performs the scroll operation */
export class ScrollViewTool extends ViewManip {
  public static toolId = "View.Scroll";
  constructor(vp: Viewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Scroll, oneShot, isDraggingRequired);
  }
}

/** tool that performs the zoom operation */
export class ZoomViewTool extends ViewManip {
  public static toolId = "View.Zoom";
  constructor(vp: Viewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Zoom, oneShot, isDraggingRequired);
  }
}

/** tool that performs the walk operation */
export class WalkViewTool extends ViewManip {
  public static toolId = "View.Walk";
  constructor(vp: Viewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Walk, oneShot, isDraggingRequired);
  }
}

/** tool that performs the fly operation */
export class FlyViewTool extends ViewManip {
  public static toolId = "View.Fly";
  constructor(vp: Viewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Fly, oneShot, isDraggingRequired);
  }
}

/** The tool that performs a fit view */
export class FitViewTool extends ViewTool {
  public static toolId = "View.Fit";
  public viewport: Viewport;
  public oneShot: boolean;
  public doAnimate: boolean;
  constructor(viewport: Viewport, oneShot: boolean, doAnimate = true) {
    super();
    this.viewport = viewport;
    this.oneShot = oneShot;
    this.doAnimate = doAnimate;
  }

  public async onDataButtonDown(_ev: BeButtonEvent): Promise<EventHandled> {
    if (_ev.viewport)
      return this.doFit(_ev.viewport, false, this.doAnimate) ? EventHandled.Yes : EventHandled.No;

    return EventHandled.No;
  }

  public onPostInstall() {
    super.onPostInstall();
    if (this.viewport)
      this.doFit(this.viewport, this.oneShot, this.doAnimate);
  }

  public doFit(viewport: Viewport, oneShot: boolean, doAnimate = true): boolean {
    ViewManip.fitView(viewport, doAnimate);
    if (oneShot)
      this.exitTool();
    return oneShot;
  }
}

/** tool that performs a Window-area view operation */
export class WindowAreaTool extends ViewTool {
  public static toolId = "View.WindowArea";
  private _haveFirstPoint: boolean = false;
  private _firstPtWorld: Point3d = Point3d.create();
  private _secondPtWorld: Point3d = Point3d.create();
  private _lastPtView?: Point3d;
  private _viewport: Viewport;
  private _corners = [new Point3d(), new Point3d()];
  private _shapePts = [new Point3d(), new Point3d(), new Point3d(), new Point3d(), new Point3d()];
  private _lineHorzPts = [new Point3d(), new Point3d()];
  private _lineVertPts = [new Point3d(), new Point3d()];
  private _fillColor = ColorDef.from(0, 0, 255, 200);

  constructor(viewport: Viewport) { super(); this._viewport = viewport; }

  public onReinitialize() { this._haveFirstPoint = false; this._firstPtWorld.setZero(); this._secondPtWorld.setZero(); }
  public async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> { if (this._haveFirstPoint) { this.onReinitialize(); return EventHandled.Yes; } return super.onResetButtonUp(ev); }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (this._haveFirstPoint) {
      this._secondPtWorld.setFrom(ev.point);
      this.doManipulation(ev, false);
      this.onReinitialize();
      this._viewport.invalidateDecorations();
    } else {
      this._firstPtWorld.setFrom(ev.point);
      this._secondPtWorld.setFrom(this._firstPtWorld);
      this._haveFirstPoint = true;
      this._lastPtView = ev.viewPoint;
    }

    return EventHandled.Yes;
  }

  public async onMouseMotion(ev: BeButtonEvent) { this.doManipulation(ev, true); }

  public async onTouchTap(ev: BeTouchEvent): Promise<EventHandled> { return ev.isSingleTap ? EventHandled.Yes : EventHandled.No; } // Prevent IdleTool from converting single tap into data button down/up...
  public async onTouchMoveStart(_ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled> { if (!this._haveFirstPoint && startEv.isSingleTouch) IModelApp.toolAdmin.convertTouchMoveStartToButtonDownAndMotion(startEv); return this._haveFirstPoint ? EventHandled.Yes : EventHandled.No; }
  public async onTouchMove(ev: BeTouchEvent): Promise<void> { if (this._haveFirstPoint) IModelApp.toolAdmin.convertTouchMoveToMotion(ev); }
  public async onTouchComplete(ev: BeTouchEvent): Promise<void> { if (this._haveFirstPoint) IModelApp.toolAdmin.convertTouchEndToButtonUp(ev); }
  public async onTouchCancel(_ev: BeTouchEvent): Promise<void> { if (this._haveFirstPoint) this.exitTool(); }

  private computeWindowCorners(): Point3d[] | undefined {
    const vp = this._viewport;
    const corners = this._corners;

    corners[0].setFrom(this._firstPtWorld);
    corners[1].setFrom(this._secondPtWorld);
    vp.worldToViewArray(corners);

    const delta = corners[1].minus(corners[0]);
    if (delta.magnitudeXY() < vp.pixelsFromInches(ToolSettings.startDragDistanceInches))
      return undefined;

    const currentDelta = this._viewport.viewDelta;
    if (currentDelta.x === 0 || delta.x === 0)
      return undefined;

    const viewAspect = currentDelta.y / currentDelta.x;
    const aspectRatio = Math.abs(delta.y / delta.x);

    let halfDeltaX;
    let halfDeltaY;
    if (aspectRatio < viewAspect) {
      halfDeltaX = Math.abs(delta.x) / 2.0;
      halfDeltaY = halfDeltaX * viewAspect;
    } else {
      halfDeltaY = Math.abs(delta.y) / 2.0;
      halfDeltaX = halfDeltaY / viewAspect;
    }

    const center = corners[0].plusScaled(delta, 0.5);
    corners[0].x = center.x - halfDeltaX;
    corners[0].y = center.y - halfDeltaY;
    corners[1].x = center.x + halfDeltaX;
    corners[1].y = center.y + halfDeltaY;
    return corners;
  }

  public decorate(context: DecorateContext): void {
    const color = this._viewport.getContrastToBackgroundColor();
    if (this._haveFirstPoint) {
      const corners = this.computeWindowCorners();
      if (undefined === corners)
        return;

      this._shapePts[0].x = this._shapePts[3].x = corners[0].x;
      this._shapePts[1].x = this._shapePts[2].x = corners[1].x;
      this._shapePts[0].y = this._shapePts[1].y = corners[0].y;
      this._shapePts[2].y = this._shapePts[3].y = corners[1].y;
      this._shapePts[0].z = this._shapePts[1].z = this._shapePts[2].z = this._shapePts[3].z = corners[0].z;
      this._shapePts[4].setFrom(this._shapePts[0]);
      this._viewport.viewToWorldArray(this._shapePts);

      const graphic = context.createWorldOverlay();

      graphic.setBlankingFill(this._fillColor);
      graphic.addShape(this._shapePts);

      graphic.setSymbology(color, color, ViewHandleWeight.Thin);
      graphic.addLineString(this._shapePts);

      graphic.setSymbology(color, color, ViewHandleWeight.FatDot);
      graphic.addPointString([this._firstPtWorld]);

      context.addWorldOverlay(graphic.finish());
      return;
    }

    if (undefined === this._lastPtView)
      return;

    const gf = context.createViewOverlay();
    gf.setSymbology(color, color, ViewHandleWeight.Thin);

    const viewRect = this._viewport.viewRect;
    const cursorPt = this._lastPtView;
    cursorPt.z = 0;

    this._lineHorzPts[0].setFrom(cursorPt);
    this._lineHorzPts[1].setFrom(cursorPt);
    this._lineHorzPts[0].x = viewRect.left;
    this._lineHorzPts[1].x = viewRect.right;
    gf.addLineString(this._lineHorzPts);

    this._lineVertPts[0].setFrom(cursorPt);
    this._lineVertPts[1].setFrom(cursorPt);
    this._lineVertPts[0].y = viewRect.top;
    this._lineVertPts[1].y = viewRect.bottom;
    gf.addLineString(this._lineVertPts);

    context.addViewOverlay(gf.finish());
  }

  private doManipulation(ev: BeButtonEvent, inDynamics: boolean): void {
    this._secondPtWorld.setFrom(ev.point);
    if (inDynamics) {
      this._lastPtView = ev.viewPoint;
      IModelApp.viewManager.invalidateDecorationsAllViews();
      return;
    }

    const corners = this.computeWindowCorners();
    if (!corners)
      return;

    let delta: Vector3d;
    const vp = this._viewport;
    const startFrust = vp.getWorldFrustum();
    vp.viewToWorldArray(corners);

    if (vp.view.is3d() && vp.view.isCameraOn) {
      const cameraView = vp.view as ViewState3d;

      const windowArray: Point3d[] = [corners[0].clone(), corners[1].clone()];
      vp.worldToViewArray(windowArray);

      const windowRange = new ViewRect(windowArray[0].x, windowArray[0].y, windowArray[1].x, windowArray[1].y);

      let npcZValues = vp.determineVisibleDepthRange(windowRange);
      if (!npcZValues)
        npcZValues = new DepthRangeNpc(0, ViewManip.getFocusPlaneNpc(vp));  // Just use the focus plane

      const lensAngle = cameraView.getLensAngle();

      vp.worldToNpcArray(corners);
      corners[0].z = corners[1].z = npcZValues.maximum;

      vp.npcToWorldArray(corners);  // Put corners back in world at correct depth
      const viewPts: Point3d[] = [corners[0].clone(), corners[1].clone()];
      vp.rotMatrix.multiplyVectorArrayInPlace(viewPts);  // rotate to view orientation to get extents

      const range = Range3d.createArray(viewPts);
      delta = Vector3d.createStartEnd(range.low, range.high);

      const focusDist = Math.max(delta.x, delta.y) / (2.0 * Math.tan(lensAngle.radians / 2));

      const newTarget = corners[0].interpolate(.5, corners[1]);
      const newEye = newTarget.plusScaled(cameraView.getZVector(), focusDist);

      if (cameraView.lookAtUsingLensAngle(newEye, newTarget, cameraView.getYVector(), lensAngle, focusDist) !== ViewStatus.Success)
        return;
    } else {
      vp.rotMatrix.multiplyVectorArrayInPlace(corners);

      const range = Range3d.createArray(corners);
      delta = Vector3d.createStartEnd(range.low, range.high);
      // get the view extents
      delta.z = vp.view.getExtents().z;

      // make sure its not too big or too small
      if (vp.view.validateViewDelta(delta, true) !== ViewStatus.Success)
        return;

      vp.view.setExtents(delta);

      const originVec = vp.rotMatrix.multiplyTransposeXYZ(range.low.x, range.low.y, range.low.z);
      vp.view.setOrigin(Point3d.createFrom(originVec));
    }

    vp.synchWithView(true);
    vp.animateFrustumChange(startFrust, vp.getFrustum());
  }
}

/** @hidden */
export class DefaultViewTouchTool extends ViewManip {
  public static toolId = ""; // touch tools installed by IdleTool are never registered
  private _lastPtView = new Point3d();
  private _startPtWorld = new Point3d();
  private _startPtView = new Point3d();
  private _startDirection = new Vector2d();
  private _startDistance = 0.0;
  private _startTouchCount = 0;
  private _frustum = new Frustum();

  constructor(startEv: BeTouchEvent, ev: BeTouchEvent) {
    super(startEv.viewport!, 0, true, false);
    this.onStart(startEv);
    this.handleEvent(ev);
  }

  public onStart(ev: BeTouchEvent): void {
    const vp = this.viewport!;
    vp.getWorldFrustum(this._frustum);
    const visiblePoint = vp.pickNearestVisibleGeometry(ev.rawPoint, vp.pixelsFromInches(ToolSettings.viewToolPickRadiusInches));
    if (undefined !== visiblePoint) {
      this._startPtWorld.setFrom(visiblePoint);
      vp.worldToView(this._startPtWorld, this._startPtView);
    } else {
      this._startPtView.setFrom(ev.viewPoint);
      this._startPtView.z = vp.worldToView(vp.view.getTargetPoint()).z;
      vp.viewToWorld(this._startPtView, this._startPtWorld);
    }
    this._lastPtView.setFrom(this._startPtView);
    this._startTouchCount = ev.touchCount;
    this._startDirection = (2 <= ev.touchCount ? Vector2d.createStartEnd(BeTouchEvent.getTouchPosition(ev.touchInfo.targetTouches[0], vp), BeTouchEvent.getTouchPosition(ev.touchInfo.targetTouches[1], vp)) : Vector2d.createZero());
    this._startDistance = (2 === ev.touchCount ? this._startDirection.magnitude() : 0.0);
  }

  private computeZoomRatio(ev: BeTouchEvent): number {
    if (0.0 === this._startDistance)
      return 1.0;

    const vp = this.viewport!;
    const distance = (2 === ev.touchCount ? BeTouchEvent.getTouchPosition(ev.touchInfo.targetTouches[0], vp).distance(BeTouchEvent.getTouchPosition(ev.touchInfo.targetTouches[1], vp)) : 0.0);

    if (0.0 === distance)
      return 1.0;

    if (Math.abs(this._startDistance - distance) < this.viewport!.pixelsFromInches(0.2))
      return 1.0;

    let zoomRatio = this._startDistance / distance;
    if (zoomRatio < 0.1)
      zoomRatio = 0.1;
    else if (zoomRatio > 10.0)
      zoomRatio = 10.0;

    return zoomRatio;
  }

  private computeRotation(ev: BeTouchEvent): Angle {
    if (ev.touchCount < 2)
      return Angle.createDegrees(0.0);

    const vp = this.viewport!;
    const direction = Vector2d.createStartEnd(BeTouchEvent.getTouchPosition(ev.touchInfo.targetTouches[0], vp), BeTouchEvent.getTouchPosition(ev.touchInfo.targetTouches[1], vp));
    const rotation = this._startDirection.angleTo(direction);

    if (Math.abs(rotation.radians) < Angle.createDegrees(5.0).radians)
      return Angle.createDegrees(0.0);

    const angularDistance = Math.abs(direction.magnitude() / 2.0 * Math.sin(Math.abs(rotation.radians)));
    const zoomDistance = Math.abs(direction.magnitude() - this._startDirection.magnitude());
    const panDistance = this._startPtView.distanceXY(this._lastPtView);

    // NOTE: The * 0.75 below is because it's easy to confuse an attempted rotate for an attempted pan, and this tries to balance that without having a false positive in the opposite direction.
    if (Math.abs(rotation.radians) > Angle.createDegrees(18.0).radians || (angularDistance > zoomDistance && angularDistance > panDistance * 0.75))
      return rotation;

    return Angle.createDegrees(0.0);
  }

  private handle2dPan(_ev: BeTouchEvent): void {
    const vp = this.viewport!;
    const screenDist = Point2d.create(this._startPtView.x - this._lastPtView.x, this._startPtView.y - this._lastPtView.y);
    vp.scroll(screenDist);
  }

  private handle2dRotateZoom(ev: BeTouchEvent): void {
    const vp = this.viewport!;
    const rotation = this.computeRotation(ev);
    const zoomRatio = this.computeZoomRatio(ev);
    const targetWorld = vp.viewToWorld(this._lastPtView);
    const translateTransform = Transform.createTranslation(this._startPtWorld.minus(targetWorld));
    const rotationTransform = Transform.createFixedPointAndMatrix(targetWorld, RotMatrix.createRotationAroundVector(vp.view.getZVector(), rotation)!);
    const scaleTransform = Transform.createScaleAboutPoint(this._startPtWorld, zoomRatio);
    const transform = translateTransform.multiplyTransformTransform(rotationTransform);

    scaleTransform.multiplyTransformTransform(transform, transform);
    const frustum = this._frustum.transformBy(transform);
    vp.setupViewFromFrustum(frustum);
  }

  private handle3dRotate(_ev: BeTouchEvent): void {
    const vp = this.viewport!;
    const viewRect = vp.viewRect;
    const xExtent = viewRect.width;
    const yExtent = viewRect.height;
    const xDelta = this._lastPtView.x - this._startPtView.x;
    const yDelta = this._lastPtView.y - this._startPtView.y;

    const xAxis = ToolSettings.preserveWorldUp ? Vector3d.unitZ() : vp.rotMatrix.getRow(1);
    const yAxis = vp.rotMatrix.getRow(0);
    const xRMatrix = (0.0 !== xDelta) ? RotMatrix.createRotationAroundVector(xAxis, Angle.createRadians(Math.PI / (xExtent / xDelta)))! : RotMatrix.identity;
    const yRMatrix = (0.0 !== yDelta) ? RotMatrix.createRotationAroundVector(yAxis, Angle.createRadians(Math.PI / (yExtent / yDelta)))! : RotMatrix.identity;
    const worldRMatrix = yRMatrix.multiplyMatrixMatrix(xRMatrix);

    const result = worldRMatrix.getAxisAndAngleOfRotation();
    const radians = Angle.createRadians(-result.angle.radians);
    const worldAxis = result.axis;

    const rotationMatrix = RotMatrix.createRotationAroundVector(worldAxis, radians);
    if (!rotationMatrix)
      return;

    const worldTransform = Transform.createFixedPointAndMatrix(this._startPtWorld, rotationMatrix);
    const frustum = this._frustum.transformBy(worldTransform);
    vp.setupViewFromFrustum(frustum);
  }

  private handle3dPanZoom(ev: BeTouchEvent): void {
    const vp = this.viewport!;
    const zoomRatio = this.computeZoomRatio(ev);

    if (vp.isCameraOn) {
      const targetWorld = vp.viewToWorld(this._lastPtView);
      const preTrans = Transform.createTranslationXYZ(-targetWorld.x, -targetWorld.y, -targetWorld.z);
      const postTrans = Transform.createTranslation(this._startPtWorld);

      preTrans.origin.scaleInPlace(zoomRatio);
      preTrans.matrix.scale(zoomRatio, preTrans.matrix);
      const cameraTransform = postTrans.multiplyTransformTransform(preTrans);

      const view = vp.view as ViewState3d;
      const oldEyePoint = view.getEyePoint();
      const newEyePoint = cameraTransform.multiplyPoint3d(oldEyePoint);
      const cameraOffset = newEyePoint.minus(oldEyePoint);
      const cameraOffsetTransform = Transform.createTranslation(cameraOffset);

      const frustum = this._frustum.transformBy(cameraOffsetTransform);
      vp.setupViewFromFrustum(frustum);
      return;
    }

    const targetNpc = vp.viewToNpc(this._lastPtView);
    const transform = Transform.createFixedPointAndMatrix(targetNpc, RotMatrix.createScale(zoomRatio, zoomRatio, 1.0));
    const viewCenter = Point3d.create(.5, .5, .5);
    const startPtNpc = vp.viewToNpc(this._startPtView);
    const shift = startPtNpc.minus(targetNpc); shift.z = 0.0;
    const offset = Transform.createTranslation(shift);

    offset.multiplyTransformTransform(transform, transform);
    transform.multiplyPoint3d(viewCenter, viewCenter);
    vp.npcToWorld(viewCenter, viewCenter);
    vp.zoom(viewCenter, zoomRatio);
  }

  private handleEvent(ev: BeTouchEvent): void {
    if (undefined === this.viewport)
      return;

    if (this._startTouchCount !== ev.touchCount) {
      this.onStart(ev);
      return;
    }

    const smallDistance = this.viewport.pixelsFromInches(0.05);
    if (this._lastPtView.isAlmostEqualXY(ev.viewPoint, smallDistance))
      return;

    if (this._startPtView.isAlmostEqualXY(ev.viewPoint, smallDistance)) {
      this._lastPtView.setFrom(this._startPtView);
    } else {
      this._lastPtView.setFrom(ev.viewPoint); this._lastPtView.z = this._startPtView.z;
    }

    if (!this.viewport.setupViewFromFrustum(this._frustum))
      return;

    if (this.viewport.view.allow3dManipulations()) {
      if (ev.isSingleTouch)
        return this.handle3dRotate(ev);

      return this.handle3dPanZoom(ev);
    }

    if (ev.isSingleTouch)
      return this.handle2dPan(ev);

    return this.handle2dRotateZoom(ev);
  }

  public async onTouchMove(ev: BeTouchEvent): Promise<void> { this.handleEvent(ev); }
  public async onTouchComplete(_ev: BeTouchEvent): Promise<void> { this.exitTool(); }
  public async onTouchCancel(_ev: BeTouchEvent): Promise<void> { this.exitTool(); }

  public async onDataButtonDown(_ev: BeButtonEvent) { return EventHandled.Yes; }
  public async onDataButtonUp(_ev: BeButtonEvent) { return EventHandled.Yes; }

}

/** tool that performs view undo operation. An application could also just call Viewport.doUndo directly, creating a ViewTool isn't required. */
export class ViewUndoTool extends ViewTool {
  public static toolId = "View.Undo";
  private _viewport: Viewport;

  constructor(vp: Viewport) { super(); this._viewport = vp; }

  public onPostInstall() {
    this._viewport.doUndo(ToolSettings.animationTime);
    this.exitTool();
  }
}

/** tool that performs view redo operation. An application could also just call Viewport.doRedo directly, creating a ViewTool isn't required. */
export class ViewRedoTool extends ViewTool {
  public static toolId = "View.Redo";
  private _viewport: Viewport;

  constructor(vp: Viewport) { super(); this._viewport = vp; }

  public onPostInstall() {
    this._viewport.doRedo(ToolSettings.animationTime);
    this.exitTool();
  }
}

/** tool that toggles the camera on/off in a spatial view */
export class ViewToggleCameraTool extends ViewTool {
  public static toolId = "View.ToggleCamera";
  private _viewport: Viewport;

  constructor(viewport: Viewport) { super(); this._viewport = viewport; }

  public onInstall(): boolean { return (undefined !== this._viewport && this._viewport.view.allow3dManipulations()); }

  public onPostInstall(): void {
    if (this._viewport.isCameraOn)
      (this._viewport.view as ViewState3d).turnCameraOff();
    else
      this._viewport.turnCameraOn();

    this._viewport.synchWithView(true);
    this.exitTool();
  }
}

/** @hidden */
export class ViewChangeRenderModeTool extends ViewTool {
  // Tool currently only used for debugging purposes. Users of imodeljs-core have the ability to set these flags from their app directly and do not need this ViewTool.
  public static toolId = "View.ChangeRenderMode";
  private _viewport: Viewport;
  // REFERENCE to app's map of rendering options to true/false values (i.e. - whether or not to display skybox, groundPlane, etc.)
  private _renderOptions: Map<string, boolean>;
  // REFERENCE to app's menu for changing render modes
  private _renderMenu: HTMLElement;
  private _renderMode: RenderMode;

  constructor(viewport: Viewport, renderOptionsMap: Map<string, boolean>, renderMenuDialog: HTMLElement, mode: RenderMode) {
    super();
    this._viewport = viewport;
    this._renderOptions = renderOptionsMap;
    this._renderMenu = renderMenuDialog;
    this._renderMode = mode;
  }

  // We want changes to happen immediately when checking or unchecking an option
  public onPostInstall() {
    const viewflags = ViewFlags.createFrom(this._viewport.viewFlags);
    viewflags.renderMode = this._renderMode;
    viewflags.acsTriad = this._renderOptions.get("ACSTriad")!;
    viewflags.fill = this._renderOptions.get("fill")!;
    viewflags.grid = this._renderOptions.get("grid")!;
    viewflags.textures = this._renderOptions.get("textures")!;
    viewflags.visibleEdges = this._renderOptions.get("visibleEdges")!;
    viewflags.materials = this._renderOptions.get("materials")!;
    viewflags.monochrome = this._renderOptions.get("monochrome")!;
    viewflags.constructions = this._renderOptions.get("constructions")!;
    viewflags.transparency = this._renderOptions.get("transparency")!;
    viewflags.hiddenEdges = this._renderOptions.get("hiddenEdges")!;
    viewflags.weights = this._renderOptions.get("weights")!;
    viewflags.styles = this._renderOptions.get("styles")!;
    viewflags.clipVolume = this._renderOptions.get("clipVolume")!;
    viewflags.backgroundMap = this._renderOptions.get("backgroundMap")!;

    const lights = this._renderOptions.get("lights")!;
    viewflags.sourceLights = lights;
    viewflags.solarLight = lights;
    viewflags.cameraLights = lights;

    // Now handle environment
    if (this._viewport.view.is3d()) {
      const view = this._viewport.view as ViewState3d;
      const displayStyle = view.getDisplayStyle3d();
      const env = displayStyle.environment;
      env.ground.display = this._renderOptions.get("groundplane")!; // Changes directly within displaystyle
      env.sky.display = this._renderOptions.get("skybox")!;  // Changes directly within displaystyle
    }

    this._viewport.view.viewFlags = viewflags;
    this._viewport.sync.invalidateController();
  }

  public async onDataButtonDown(_ev: BeButtonEvent): Promise<EventHandled> {
    this._renderMenu.style.display = "none";
    this.exitTool();
    return EventHandled.Yes;
  }
}
