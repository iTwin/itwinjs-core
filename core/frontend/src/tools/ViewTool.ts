/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { BeButtonEvent, BeCursor, BeWheelEvent, CoordSource, BeGestureEvent, GestureInfo, InteractiveTool } from "./Tool";
import { Viewport, CoordSystem, DepthRangeNpc, ViewRect } from "../Viewport";
import { Point3d, Vector3d, YawPitchRollAngles, Point2d, Vector2d } from "@bentley/geometry-core";
import { RotMatrix, Transform } from "@bentley/geometry-core";
import { Range3d } from "@bentley/geometry-core";
import { Frustum, NpcCenter, Npc, ColorDef, ViewFlags, RenderMode } from "@bentley/imodeljs-common";
import { MarginPercent, ViewStatus, ViewState3d } from "../ViewState";
import { BeDuration } from "@bentley/bentleyjs-core";
import { Angle } from "@bentley/geometry-core";
import { IModelApp } from "../IModelApp";
import { DecorateContext } from "../ViewContext";
import { TentativeOrAccuSnap } from "../AccuSnap";
import { GraphicBuilder } from "../rendering";

const scratchFrustum = new Frustum();
const scratchTransform1 = Transform.createIdentity();
const scratchTransform2 = Transform.createIdentity();
const scratchRotMatrix1 = new RotMatrix();
const scratchPoint3d1 = new Point3d();
const scratchPoint3d2 = new Point3d();
const scratchVector3d1 = new Vector3d();
const scratchVector3d2 = new Vector3d();

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
  ViewPan = 1 << 2,
  ViewScroll = 1 << 3,
  ViewZoom = 1 << 4,
  ViewWalk = 1 << 5,
  ViewFly = 1 << 6,
  ViewWalkMobile = 1 << 7, // Uses tool state instead of mouse for input
  ViewLook = 1 << 9,
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

const enum NavigateMode {
  Pan = 0,
  Look = 1,
  Travel = 2,
}

// tslint:disable-next-line:variable-name
export const ViewToolSettings = {
  preserveWorldUp: true,
  walkEnforceZUp: true,
  viewBallRadius: 0.35, // percent of screen width
  walkVelocity: 3.5,      // in meters/second
  walkCameraAngle: Angle.createDegrees(75.6),  // in degrees
  animationTime: BeDuration.fromMilliseconds(260),
  animateZoom: false,
  pickSize: 13,
};

/** An InteractiveTool that manipulates a view. */
export abstract class ViewTool extends InteractiveTool {
  public inDynamicUpdate = false;
  public beginDynamicUpdate() { this.inDynamicUpdate = true; }
  public endDynamicUpdate() { this.inDynamicUpdate = false; }
  public run(): boolean {
    const toolAdmin = IModelApp.toolAdmin;
    if (!toolAdmin.onInstallTool(this))
      return false;

    // toolAdmin.setViewTool(undefined);
    toolAdmin.startViewTool();
    toolAdmin.setViewTool(this);
    toolAdmin.onPostInstallTool(this);
    return true;
  }

  public onResetButtonUp(_ev: BeButtonEvent) { this.exitTool(); return true; }

  public onSelectedViewportChanged(_previous: Viewport | undefined, _current: Viewport | undefined): void { }

  /** Do not override. */
  public exitTool(): void { IModelApp.toolAdmin.exitViewTool(); }
}

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
    // all handle objects must draw themselves
    for (let i = 0; i < this.count; i++) {
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
    if (this.focus === index && (this.focusDrag === this.viewTool.isDragging))
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
    this.focusDrag = this.viewTool.isDragging;

    if (undefined !== this.viewport)
      this.viewport.invalidateDecorations();
  }

  public onReinitialize(): void {
    this.handles.forEach((handle: ViewingToolHandle | undefined) => {
      if (undefined !== handle)
        handle.onReinitialize();
    });
  }

  /** determine whether a handle of a specific type exists */
  public hasHandle(handleType: ViewHandleType): boolean {
    for (let i = 0; i < this.count; ++i) {
      const handle = this.getByIndex(i);
      if (handle && handle.handleType === handleType)
        return true;
    }

    return false;
  }

  public getHandleByType(handleType: ViewHandleType): ViewingToolHandle | undefined {
    for (let i = 0; i < this.count; i++) {
      const handle = this.getByIndex(i);
      if (handle && handle.handleType === handleType)
        return handle;
    }

    return undefined;
  }

  public motion(ev: BeButtonEvent): boolean {
    this.handles.forEach((handle) => { if (handle) handle.motion(ev); });
    return true;
  }
}

/** Base class for tools that manipulate the viewing frustum of a Viewport */
export abstract class ViewManip extends ViewTool {
  public viewport?: Viewport = undefined;
  public viewHandles: ViewHandleArray;
  public frustumValid = false;
  public alwaysLeaveLastView = false;
  public ballRadius = 0;          // screen coords
  public readonly lastPtScreen = new Point3d();
  public readonly targetCenterWorld = new Point3d();
  public isDragging = false;
  public isDragOperation = false;
  public stoppedOverHandle = false;
  public wantMotionStop = true;
  public targetCenterValid = false;
  public targetCenterLocked = false;
  public supportsOrientationEvents = true;
  public nPts = 0;
  public forcedHandle = ViewHandleType.None;
  public readonly lastFrustum = new Frustum();

  constructor(viewport: Viewport | undefined, public handleMask: number, public isOneShot: boolean, public scrollOnNoMotion: boolean,
    public isDragOperationRequired: boolean = false) {
    super();
    this.viewHandles = new ViewHandleArray(this);
    this.changeViewport(viewport);
  }

  public decorate(context: DecorateContext): void {
    this.viewHandles.drawHandles(context);
  }

  public onReinitialize(): void {
    IModelApp.toolAdmin.gesturePending = false;

    if (undefined !== this.viewport) {
      this.viewport.synchWithView(true); // make sure we store any changes in view undo buffer.
      this.viewHandles.setFocus(-1);
    }

    this.nPts = 0;
    this.isDragging = false;
    this.inDynamicUpdate = false;
    this.frustumValid = false;

    this.viewHandles.onReinitialize();
  }

  public onDataButtonDown(ev: BeButtonEvent): boolean {
    // Tool was started in "drag required" mode, don't advance tool state and wait to see if we get the start drag event.
    if (0 === this.nPts && this.isDragOperationRequired && !this.isDragOperation)
      return false;

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
      if (this.processPoint(ev, false) && this.isOneShot)
        this.exitTool();
      else
        this.onReinitialize();
    }

    return true;
  }

  public onDataButtonUp(_ev: BeButtonEvent): boolean {
    if (this.nPts <= 1 && this.isDragOperationRequired && !this.isDragOperation && this.isOneShot)
      this.exitTool();

    return false;
  }

  public onMiddleButtonDown(_ev: BeButtonEvent): boolean {
    // Just let idle tool handle this...
    return false;
  }

  public onMiddleButtonUp(_ev: BeButtonEvent): boolean {
    // Can only support middle button for viewing tools in drag mode in order to allow middle click for tentative...
    if (this.nPts <= 1 && !this.isDragOperation && this.isOneShot)
      this.exitTool();

    return false;
  }

  public onMouseWheel(inputEv: BeWheelEvent): boolean {
    const ev = inputEv.clone();

    // If the rotate is active, the mouse wheel should work as if the cursor is at the target center
    if ((this.handleMask & ViewHandleType.Rotate)) {
      ev.point = this.targetCenterWorld;
      ev.coordsFrom = CoordSource.Precision; // don't want raw point used...
    }

    IModelApp.toolAdmin.processWheelEvent(ev, false);
    this.doUpdate(true);
    return true;
  }

  public onModelStartDrag(ev: BeButtonEvent): boolean {
    this.isDragOperation = true;
    this.stoppedOverHandle = false;

    IModelApp.toolAdmin.gesturePending = false;
    if (0 === this.nPts)
      this.onDataButtonDown(ev);

    return true;
  }

  public onModelEndDrag(ev: BeButtonEvent): boolean {
    this.isDragOperation = false;
    return 0 === this.nPts || this.onDataButtonDown(ev);
  }

  public onModelMotion(ev: BeButtonEvent): void {
    this.stoppedOverHandle = false;
    if (0 === this.nPts && this.viewHandles.testHit(ev.viewPoint))
      this.viewHandles.focusHitHandle();

    if (0 !== this.nPts)
      this.processPoint(ev, true);

    this.viewHandles.motion(ev);
  }

  public onModelMotionStopped(ev: BeButtonEvent): void {
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

  public onModelNoMotion(ev: BeButtonEvent): void {
    if (0 === this.nPts || !ev.viewport)
      return;

    const hitHandle = this.viewHandles.hitHandle;
    if (hitHandle && hitHandle.noMotion(ev))
      this.doUpdate(false);
  }

  public onPostInstall(): void {
    super.onPostInstall();
    this.onReinitialize(); // Call onReinitialize now that tool is installed.
  }

  public onCleanup(): void {
    let restorePrevious = false;

    if (this.inDynamicUpdate) {
      this.endDynamicUpdate();
      restorePrevious = !this.alwaysLeaveLastView;
    }

    const vp = this.viewport;
    if (undefined !== vp) {
      vp.synchWithView(true);

      if (restorePrevious)
        vp.doUndo(BeDuration.fromSeconds(0));

      vp.invalidateDecorations();
    }
    this.viewHandles.empty();
    this.viewport = undefined;
  }

  public isSameFrustum(): boolean {
    const frust = this.viewport!.getWorldFrustum(scratchFrustum);
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
      if (this.isDragging)
        return;
      if (IModelApp.tentativePoint.isActive) {
        this.setTargetCenterWorld(IModelApp.tentativePoint.getPoint(), true, false);
        IModelApp.tentativePoint.clear(true); // Clear tentative, there won't be a datapoint to accept...
      }
      return;
    }

    if (IModelApp.tentativePoint.isActive) {
      this.setTargetCenterWorld(IModelApp.tentativePoint.getPoint(), true, false);
      return;
    }

    if (TentativeOrAccuSnap.isHot()) {
      this.setTargetCenterWorld(TentativeOrAccuSnap.getCurrentPoint(), true, false);
      return;
    }

    if (vp.viewCmdTargetCenter && this.isPointVisible(vp.viewCmdTargetCenter)) {
      this.setTargetCenterWorld(vp.viewCmdTargetCenter, true, true);
      return;
    }

    if (!vp.view.allow3dManipulations()) {
      const defaultPoint = vp.npcToWorld(NpcCenter); defaultPoint.z = 0.0;
      this.setTargetCenterWorld(defaultPoint, false, false);
      return;
    }

    const visiblePoint = vp.determineNearestVisibleGeometryPoint(vp.npcToWorld(NpcCenter), 20.0);
    this.setTargetCenterWorld(undefined !== visiblePoint ? visiblePoint : vp.view.getTargetPoint(), false, false);
  }

  public processFirstPoint(ev: BeButtonEvent) {
    const forcedHandle = this.forcedHandle;
    this.forcedHandle = ViewHandleType.None;
    this.frustumValid = false;

    if (this.viewHandles.testHit(ev.viewPoint, forcedHandle)) {
      this.isDragging = true;
      this.viewHandles.focusHitHandle();
      const handle = this.viewHandles.hitHandle;
      if (undefined !== handle && !handle.firstPoint(ev))
        return false;
    }

    return true;
  }

  public processPoint(ev: BeButtonEvent, inDynamics: boolean) {
    const hitHandle = this.viewHandles.hitHandle;
    if (undefined === hitHandle) {
      return true;
    }

    const doUpdate = hitHandle.doManipulation(ev, inDynamics);
    if (doUpdate)
      this.doUpdate(true);

    return inDynamics || (doUpdate && hitHandle.checkOneShot());
  }

  public lensAngleMatches(angle: Angle, tolerance: number) {
    const cameraView = this.viewport!.view;
    return !cameraView.is3d() ? false : Math.abs(cameraView.calcLensAngle().radians - angle.radians) < tolerance;
  }

  public isZUp() {
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

  public doUpdate(_abortOnButton: boolean) {
    // we currently have no built-in support for dynamics, therefore nothing to update.
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
    const frustum = vp.getFrustum(CoordSystem.View, false, scratchFrustum);

    const screenRange = scratchPoint3d1;
    screenRange.x = frustum.points[Npc._000].distance(frustum.points[Npc._100]);
    screenRange.y = frustum.points[Npc._000].distance(frustum.points[Npc._010]);
    screenRange.z = frustum.points[Npc._000].distance(frustum.points[Npc._001]);

    return (!((testPtView.x < 0 || testPtView.x > screenRange.x) || (testPtView.y < 0 || testPtView.y > screenRange.y)));
  }

  protected static _useViewAlignedVolume: boolean = false;
  public static fitView(viewport: Viewport, doUpdate: boolean, marginPercent?: MarginPercent) {
    const range = viewport.computeViewRange();
    const aspect = viewport.viewRect.aspect;
    const before = viewport.getWorldFrustum(scratchFrustum);

    if (this._useViewAlignedVolume)
      viewport.view.lookAtViewAlignedVolume(range, aspect, marginPercent);
    else
      viewport.view.lookAtVolume(range, aspect, marginPercent);

    viewport.synchWithView(false);
    viewport.viewCmdTargetCenter = undefined;
    if (doUpdate)
      viewport.animateFrustumChange(before, viewport.getFrustum(), ViewToolSettings.animationTime);

    viewport.synchWithView(true);
  }

  public setCameraLensAngle(lensAngle: Angle, retainEyePoint: boolean): ViewStatus {
    const vp = this.viewport;
    if (!vp)
      return ViewStatus.InvalidViewport;

    const view = vp.view;
    if (!view || !view.is3d())
      return ViewStatus.InvalidViewport;

    const result = (retainEyePoint && view.isCameraOn()) ?
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
    if (!vp || this.isZUp())
      return false;

    const view = vp.view;
    const viewY = view.getYVector();
    const rotMatrix = RotMatrix.createRotationVectorToVector(viewY, Vector3d.unitZ(), scratchRotMatrix1);
    if (!rotMatrix)
      return false;

    const transform = Transform.createFixedPointAndMatrix(pivotPoint, rotMatrix, scratchTransform1);
    const frust = vp.getWorldFrustum(scratchFrustum);
    frust.multiply(transform);
    vp.setupViewFromFrustum(frust);
    return true;
  }

  public viewPtToSpherePt(viewPt: Point3d, invertY: boolean, result?: Vector3d): Vector3d | undefined {
    const vp = this.viewport!;
    const ballRadius = this.ballRadius;
    const targetCenterView = vp.worldToView(this.targetCenterWorld, scratchPoint3d1);

    const ballMouse = scratchPoint3d2;
    ballMouse.x = (viewPt.x - targetCenterView.x) / ballRadius;
    ballMouse.y = (viewPt.y - targetCenterView.y) / ballRadius;

    const mag = (ballMouse.x * ballMouse.x) + (ballMouse.y * ballMouse.y);
    if (mag > 1.0 || !vp.view.allow3dManipulations()) {
      // we're outside of the circle
      if (mag <= 0.0)
        return undefined;

      const scale = 1.0 / Math.sqrt(mag);
      ballMouse.x *= scale;
      ballMouse.y *= scale;
      ballMouse.z = 0.0;
    } else {
      ballMouse.z = vp.view.allow3dManipulations() ? Math.sqrt(1.0 - mag) : 0.0;
    }

    if (invertY)
      ballMouse.y = -ballMouse.y;

    result = result ? result : new Vector3d();
    result.setFrom(ballMouse);
    return result;
  }

  public ballPointsToMatrix(matrix: RotMatrix | undefined, axisVector: Vector3d | undefined, ballVector0: Vector3d, ballVector1: Vector3d): Angle {
    const normal = ballVector1.crossProduct(ballVector0);
    const theta = ballVector1.angleTo(ballVector0);
    if (matrix)
      RotMatrix.createRotationAroundVector(normal, theta, matrix);
    if (axisVector)
      axisVector.setFrom(normal);
    return theta;
  }

  protected synchViewBallInfo(): void {
    if (!this.viewport)
      return;
    const frustum = this.viewport.getFrustum(CoordSystem.View, false, scratchFrustum);
    const screenRange = scratchPoint3d1;
    screenRange.set(
      frustum.points[Npc._000].distance(frustum.points[Npc._100]),
      frustum.points[Npc._000].distance(frustum.points[Npc._010]),
      frustum.points[Npc._000].distance(frustum.points[Npc._001]));

    this.ballRadius = (((screenRange.x < screenRange.y) ? screenRange.x : screenRange.y) * ViewToolSettings.viewBallRadius);
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

    if (this.handleMask & ViewHandleType.Rotate) {
      // Setup initial view ball size and location...
      this.synchViewBallInfo();
      this.viewHandles.add(new ViewRotate(this));
    }

    if (this.handleMask & ViewHandleType.TargetCenter)
      this.viewHandles.add(new ViewTargetCenter(this));

    // if (this.handleMask & ViewHandleType.ViewScroll)
    //   this.viewHandles.add(new ViewScroll(this));

    if (this.handleMask & ViewHandleType.ViewPan)
      this.viewHandles.add(new ViewPan(this));

    // if (this.handleMask & ViewHandleType.ViewZoom)
    //   this.viewHandles.add(new ViewZoom(this));

    if (this.handleMask & ViewHandleType.ViewWalk)
      this.viewHandles.add(new ViewWalk(this));

    // if (this.handleMask & ViewHandleType.ViewWalkMobile)
    //   this.viewHandles.add(new ViewWalkMobile(this));

    // if (this.handleMask & ViewHandleType.ViewFly)
    //   this.viewHandles.add(new ViewFly(this));

    // if (this.handleMask & ViewHandleType.ViewLook)
    //   this.viewHandles.add(new ViewLook(this));
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
    if (this.viewTool.isDragOperationRequired)
      return false; // Target center handle is not usable in this mode...

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
    if (!hasFocus && this.viewTool.isDragging) {
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
  private anchorPt: Point3d = new Point3d();
  private lastPtNpc: Point3d = new Point3d();
  public get handleType() { return ViewHandleType.ViewPan; }
  public getHandleCursor() { return this.viewTool.isDragging ? BeCursor.ClosedHand : BeCursor.OpenHand; }

  public doManipulation(ev: BeButtonEvent, _inDynamics: boolean) {
    const vp = ev.viewport!;
    const newPtWorld = ev.point.clone();
    const thisPtNpc = vp.worldToNpc(newPtWorld);
    const firstPtNpc = vp.worldToNpc(this.anchorPt);

    thisPtNpc.z = firstPtNpc.z;

    if (this.lastPtNpc.isAlmostEqual(thisPtNpc, 1.0e-10))
      return true;

    vp.npcToWorld(thisPtNpc, newPtWorld);
    this.lastPtNpc.setFrom(thisPtNpc);
    return this.doPan(newPtWorld);
  }

  public firstPoint(ev: BeButtonEvent) {
    const vp = ev.viewport!;
    this.anchorPt.setFrom(ev.rawPoint);

    // if the camera is on, we need to find the element under the starting point to get the z
    if (CoordSource.User === ev.coordsFrom && vp.isCameraOn()) {
      const visiblePoint = vp.determineNearestVisibleGeometryPoint(this.anchorPt, 20.0);
      if (undefined !== visiblePoint) {
        this.anchorPt.setFrom(visiblePoint);
      } else {
        const firstPtNpc = vp.worldToNpc(this.anchorPt);
        firstPtNpc.z = ViewManip.getFocusPlaneNpc(vp);
        this.anchorPt = vp.npcToWorld(firstPtNpc, this.anchorPt);
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
    const dist = newPtWorld.vectorTo(this.anchorPt);

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

class ViewRotate extends ViewingToolHandle {
  private lastPtNpc = new Point3d();
  private firstPtNpc = new Point3d();
  private ballVector0 = new Vector3d();
  private frustum = new Frustum();
  private activeFrustum = new Frustum();
  public get handleType() { return ViewHandleType.Rotate; }
  public getHandleCursor() { return BeCursor.Rotate; }

  public testHandleForHit(ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    const targetPt = this.viewTool.viewport!.worldToView(this.viewTool.targetCenterWorld);
    out.distance = targetPt.distanceXY(ptScreen);
    out.priority = ViewManipPriority.Normal;
    return true;
  }

  public firstPoint(ev: BeButtonEvent) {
    if (IModelApp.toolAdmin.gesturePending)
      return false;

    const tool = this.viewTool;
    const vp = ev.viewport!;

    if (!tool.targetCenterLocked && vp.view.allow3dManipulations()) {
      const visiblePoint = vp.determineNearestVisibleGeometryPoint(ev.rawPoint, 20.0);
      if (undefined !== visiblePoint)
        tool.setTargetCenterWorld(visiblePoint, false, false);
    }

    const pickPt = ev.rawPoint.clone();
    const pickPtOrig = pickPt.clone();

    const viewPt = vp.worldToView(pickPt);
    tool.viewPtToSpherePt(viewPt, true, this.ballVector0);

    vp.worldToNpc(pickPtOrig, this.firstPtNpc);
    this.lastPtNpc.setFrom(this.firstPtNpc);

    vp.getWorldFrustum(this.activeFrustum);
    this.frustum.setFrom(this.activeFrustum);

    tool.beginDynamicUpdate();
    return true;
  }

  public doManipulation(ev: BeButtonEvent, _inDynamics: boolean): boolean {
    const tool = this.viewTool;
    const viewport = tool.viewport!;
    const ptNpc = viewport.worldToNpc(ev.point);
    if (this.lastPtNpc.isAlmostEqual(ptNpc, 1.0e-10)) // no movement since last point
      return true;

    if (this.firstPtNpc.isAlmostEqual(ptNpc, 1.0e-2)) // too close to anchor pt
      ptNpc.setFrom(this.firstPtNpc);

    this.lastPtNpc.setFrom(ptNpc);
    const currentFrustum = viewport.getWorldFrustum(scratchFrustum);
    const frustumChange = !currentFrustum.equals(this.activeFrustum);
    if (frustumChange)
      this.frustum.setFrom(currentFrustum);
    else if (!viewport.setupViewFromFrustum(this.frustum))
      return false;

    const currPt = viewport.npcToView(ptNpc, scratchPoint3d2);
    if (frustumChange) {
      this.firstPtNpc.setFrom(ptNpc);
      tool.viewPtToSpherePt(currPt, true, this.ballVector0);
    }

    let radians: Angle;
    let worldAxis: Vector3d;
    const worldPt = tool.targetCenterWorld;
    if (!viewport.view.allow3dManipulations()) {
      const currBallPt = this.viewTool.viewPtToSpherePt(currPt, true)!;

      const axisVector = new Vector3d();
      radians = tool.ballPointsToMatrix(undefined, axisVector, this.ballVector0, currBallPt);

      const viewMatrix = viewport.rotMatrix;
      const xVec = viewMatrix.getRow(0);
      const yVec = viewMatrix.getRow(1);
      const zVec = viewMatrix.getRow(2);
      worldAxis = Vector3d.add3Scaled(xVec, axisVector.x, yVec, axisVector.y, zVec, axisVector.z);
    } else {
      const viewRect = viewport.viewRect;
      const xExtent = viewRect.width;
      const yExtent = viewRect.height;

      viewport.npcToView(ptNpc, currPt);
      const firstPt = viewport.npcToView(this.firstPtNpc);

      const xDelta = (currPt.x - firstPt.x);
      const yDelta = (currPt.y - firstPt.y);

      // Movement in screen x == rotation about drawing Z (preserve up) or rotation about screen  Y...
      const xAxis = ViewToolSettings.preserveWorldUp ? Vector3d.unitZ() : viewport.rotMatrix.getRow(1);

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
    // viewport.moveViewToSurfaceIfRequired();
    viewport.getWorldFrustum(this.activeFrustum);

    return true;
  }

  private rotateViewWorld(worldOrigin: Point3d, worldAxisVector: Vector3d, primaryAngle: Angle) {
    const worldMatrix = RotMatrix.createRotationAroundVector(worldAxisVector, primaryAngle);
    if (!worldMatrix)
      return;
    const worldTransform = Transform.createFixedPointAndMatrix(worldOrigin, worldMatrix!);
    const frustum = this.frustum.clone();
    frustum.multiply(worldTransform);
    this.viewTool.viewport!.setupViewFromFrustum(frustum);
  }
}

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
    const trans = scratchPoint3d1;
    trans.x = trans.y = 0;
    trans.z = distance * this.deltaTime;
    Transform.createTranslation(trans, this.transform);
  }

  public modifyPitchAngleToPreventInversion(pitchAngle: number): number {
    const angleLimit = Angle.degreesToRadians(85);
    const angleTolerance = Angle.degreesToRadians(0.01);

    if (0.0 === pitchAngle)
      return 0.0;

    const viewUp = this.getViewUp(scratchVector3d1);
    const viewDir = this.getViewDirection(scratchVector3d2);
    const worldUp = Vector3d.unitZ();

    let viewAngle = worldUp.angleTo(viewUp).radians;
    if (viewDir.z < 0)
      viewAngle *= -1;

    let newAngle = pitchAngle + viewAngle;
    if (Math.abs(newAngle) < angleLimit)
      return pitchAngle;  // not close to the limit
    if ((pitchAngle > 0) !== (viewAngle > 0) && (Math.abs(pitchAngle) < Math.PI / 2))
      return pitchAngle;  // tilting away from the limit
    if (Math.abs(viewAngle) >= (angleLimit - angleTolerance))
      return 0.0;         // at the limit already

    const difference = Math.abs(newAngle) - angleLimit;
    newAngle = (pitchAngle > 0) ? pitchAngle - difference : pitchAngle + difference;
    return newAngle;        // almost at the limit, but still can go a little bit closer
  }

  public getWorldUp(result?: Vector3d) {
    const up = Vector3d.createFrom(Vector3d.unitZ(), result);
    //    this.viewport.geometry.rootTransform.multiplyByPointAsVector(Cartesian3.UNIT_Z, up);
    return up;
  }

  public generateRotationTransform(yawRate: number, pitchRate: number, result?: Transform): Transform {
    const vp = this.viewport;
    const view = vp.view as ViewState3d;
    const viewRot = vp.rotMatrix;
    const invViewRot = viewRot.inverse(scratchRotMatrix1)!;
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
    if (this.viewport.isCameraOn()) {
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
      const up = this.getWorldUp();
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
    const rotateTrans = this.generateRotationTransform(angularVelocityX, angularVelocityY, scratchTransform1);
    const dollyTrans = this.generateTranslationTransform(linearVelocity, isConstrainedToXY, scratchTransform2);
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

  public look(yawRate: number, pitchRate: number): void {
    this.generateRotationTransform(yawRate, pitchRate, this.transform);
  }

  /** reset pitch of view to zero */
  public resetToLevel(): void {
    const view = this.viewport.view;
    if (!view.is3d() || !view.isCameraOn())
      return;
    const angles = YawPitchRollAngles.createFromRotMatrix(this.viewport.rotMatrix)!;
    angles.pitch.setRadians(0); // reset pitch to zero
    Transform.createFixedPointAndMatrix(view.getEyePoint(), angles.toRotMatrix(scratchRotMatrix1), this.transform);
  }
}

abstract class ViewNavigate extends ViewingToolHandle {
  private anchorPtView = new Point3d();
  private lastPtView = new Point3d();
  private initialized = false;
  private lastMotionTime = 0;
  private orientationValid = false;
  private orientationTime = 0;
  private orientationZ = new Vector3d();
  protected abstract getNavigateMotion(elapsedTime: number): NavigateMotion | undefined;

  constructor(viewManip: ViewManip) { super(viewManip); }

  private static angleLimit = 0.075;
  private static timeLimit = 500;
  private haveStaticOrientation(zVec: Vector3d, currentTime: number): boolean {
    if (!this.orientationValid || zVec.angleTo(this.orientationZ).radians > ViewNavigate.angleLimit || this.orientationZ.isAlmostZero()) {
      this.orientationValid = true;
      this.orientationTime = currentTime;
      this.orientationZ = zVec;
      return false;
    }
    return (currentTime - this.orientationTime) > ViewNavigate.timeLimit;
  }

  private tryOrientationEvent(_forward: Vector3d, _ev: BeButtonEvent): { eventsEnabled: boolean, result: OrientationResult } {
    return { eventsEnabled: false, result: OrientationResult.NoEvent };
  }

  private getElapsedTime(currentTime: number): number {
    let elapsedTime = currentTime - this.lastMotionTime;
    if (0 === this.lastMotionTime || elapsedTime < 0 || elapsedTime > 1000)
      elapsedTime = 100;
    return elapsedTime;
  }

  public getMaxLinearVelocity() { return ViewToolSettings.walkVelocity; }
  public getMaxAngularVelocity() { return Math.PI / 4; }
  public testHandleForHit(_ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    out.distance = 0.0;
    out.priority = ViewManipPriority.Low;
    return true;
  }

  public getInputVector(result?: Vector3d): Vector3d {
    const inputDeadZone = 5.0;
    const input = this.anchorPtView.vectorTo(this.lastPtView, result);
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
    if (state.isShiftDown || !this.viewTool.viewport!.isCameraOn())
      return NavigateMode.Pan;
    return state.isControlDown ? NavigateMode.Look : NavigateMode.Travel;
  }

  private static scratchForward = new Vector3d();
  public doNavigate(ev: BeButtonEvent): boolean {
    const currentTime = Date.now();
    const forward = ViewNavigate.scratchForward;
    const orientationEvent = this.tryOrientationEvent(forward, ev);
    const orientationResult = orientationEvent.result;
    const elapsedTime = this.getElapsedTime(currentTime);
    this.lastMotionTime = currentTime;

    const vp = this.viewTool.viewport!;
    const motion = this.getNavigateMotion(elapsedTime);
    let haveNavigateEvent: boolean = !!motion;
    if (haveNavigateEvent) {
      const frust = vp.getWorldFrustum(scratchFrustum);
      frust.multiply(motion!.transform);
      if (!vp.setupViewFromFrustum(frust)) {
        haveNavigateEvent = false;
        if (OrientationResult.NoEvent === orientationResult)
          return false;
      }
    }

    let doFull = false;
    let doDynamic = false;
    if (haveNavigateEvent)
      doDynamic = true;
    else {
      switch (orientationResult) {
        case OrientationResult.Disabled:
        case OrientationResult.NoEvent:
          doFull = true;
          break;
        case OrientationResult.RejectedByController:
          if (!this.haveStaticOrientation(forward, currentTime))
            return false;

          doFull = true;
          break;
        case OrientationResult.Success:
          if (this.haveStaticOrientation(forward, currentTime))
            doFull = true;
          else
            doDynamic = true;
          break;
      }
    }

    if (doFull) {
      this.viewTool.endDynamicUpdate();
      this.viewTool.doUpdate(true);
      this.viewTool.beginDynamicUpdate();
      return false;
    }

    return doDynamic;
  }

  public doManipulation(ev: BeButtonEvent, inDynamics: boolean): boolean {
    if (!inDynamics)
      return true;
    else if (ev.viewport !== this.viewTool.viewport)
      return false;

    this.lastPtView.setFrom(ev.viewPoint);
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
    if (this.initialized)
      return;

    this.initialized = true;
    const tool = this.viewTool;
    const vp = tool.viewport!;
    const view = vp.view;
    if (!view.is3d() || !view.allow3dManipulations())
      return;

    const startFrust = vp.getWorldFrustum();
    const walkAngle = ViewToolSettings.walkCameraAngle;
    if (!tool.lensAngleMatches(walkAngle, Angle.degreesToRadians(10)) || !tool.isZUp()) {
      //  This turns on the camera if its not already on. It also assures the camera is centered. Obviously this is required if
      //  the camera is not on or the lens angle is not what we want. We also want to do it if Z will be
      //  adjusted because EnforceZUp swivels the camera around what GetTargetPoint returns. If the FocusDistance is not set to something
      //  reasonable the target point may be far beyond anything relevant.
      tool.setCameraLensAngle(walkAngle, tool.lensAngleMatches(walkAngle, Angle.degreesToRadians(45.)));
    }

    if (ViewToolSettings.walkEnforceZUp)
      this.viewTool.enforceZUp(view.getTargetPoint());

    const endFrust = vp.getWorldFrustum();
    if (!startFrust.equals(endFrust))
      vp.animateFrustumChange(startFrust, endFrust, ViewToolSettings.animationTime);

    this.getCenterPoint(this.anchorPtView);

    // const that = this;
    // this._removeEventListener = vp.cameraToggled.addEventListener(function () { if (!vp.isCameraOn) that.viewTool.exitTool(); });
  }

  public onCleanup(): void {
    //   if (Cesium.defined(this._removeEventListener)) {
    //     this._removeEventListener();
    //     this._removeEventListener = undefined;
    //   }
  }

  public firstPoint(ev: BeButtonEvent): boolean {
    // NB: In desktop apps we want to center the cursor in the view.
    // The browser doesn't support that, and it is more useful to be able to place the anchor point freely anyway.
    this.viewTool.beginDynamicUpdate();
    this.lastPtView.setFrom(ev.viewPoint);
    this.anchorPtView.setFrom(this.lastPtView);

    // this.decoration = new WalkDecoration(this.viewport.canvas.parentElement, this.anchorPtView, this.viewport.getContrastToBackgroundColor());
    return true;
  }

  public getHandleCursor(): BeCursor { return BeCursor.CrossHair; }
  public focusOut() {
    // this.decoration = this.decoration && this.decoration.destroy();
  }

  public drawHandle(context: DecorateContext, _hasFocus: boolean): void {
    if (context.viewport !== this.viewTool.viewport || !this.viewTool.inDynamicUpdate)
      return;

    const point = new Point2d(this.anchorPtView.x, this.anchorPtView.y);
    const points = [point];
    const black = ColorDef.black.clone();
    let graphic = context.createViewOverlay();
    graphic.setSymbology(black, black, 9);
    graphic.addPointString2d(points, 0.0);
    context.addViewOverlay(graphic.finish());

    const white = ColorDef.white.clone();
    graphic = context.createViewOverlay();
    graphic.setSymbology(white, black, 5);
    graphic.addPointString2d(points, 0.0);
    context.addViewOverlay(graphic.finish());
  }
}

class ViewWalk extends ViewNavigate {
  private navigateMotion: NavigateMotion;

  constructor(viewManip: ViewManip) {
    super(viewManip);
    this.navigateMotion = new NavigateMotion(this.viewTool.viewport!);
  }
  public get handleType(): ViewHandleType { return ViewHandleType.ViewWalk; }

  protected getNavigateMotion(elapsedTime: number): NavigateMotion | undefined {
    const input = this.getInputVector(scratchVector3d1);
    if (0 === input.x && 0 === input.y)
      return undefined;

    const motion = this.navigateMotion;
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
        motion.travel(-input.x * this.getMaxAngularVelocity(), 0, -input.y * this.getMaxLinearVelocity(), true);  // ###TODO: multiplied input.x by -1 added as temporary fix for unknown bug causing inverse walk directions
        break;
    }

    return motion;
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

  public onDataButtonDown(_ev: BeButtonEvent): boolean {
    if (_ev.viewport) {
      return this.doFit(_ev.viewport, false, this.doAnimate);
    }
    return false;
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

/** The tool that performs a Pan view operation */
export class PanTool extends ViewManip {
  public static toolId = "View.Pan";
  constructor(vp: Viewport, oneShot = false, scrollOnNoMotion = false, isDragOperationRequired = false) {
    super(vp, ViewHandleType.ViewPan, oneShot, scrollOnNoMotion, isDragOperationRequired);
  }
}

/** tool that performs a Rotate view operation */
export class RotateTool extends ViewManip {
  public static toolId = "View.Rotate";
  constructor(vp: Viewport, oneShot = false, scrollOnNoMotion = false, isDragOperationRequired = false) {
    super(vp, isDragOperationRequired ? ViewHandleType.Rotate : ViewHandleType.TargetCenter | ViewHandleType.ViewPan | ViewHandleType.Rotate, oneShot, scrollOnNoMotion, isDragOperationRequired);
  }
}

/** tool that performs the walk operation */
export class ViewWalkTool extends ViewManip {
  public static toolId = "View.Walk";
  constructor(vp: Viewport) { super(vp, ViewHandleType.ViewWalk, false, true, false); }
}

/** tool that performs a Window-area view operation */
export class WindowAreaTool extends ViewTool {
  public static toolId = "View.WindowArea";

  private haveFirstPoint: boolean = false;
  private firstPtWorld: Point3d = Point3d.create();
  private secondPtWorld: Point3d = Point3d.create();
  private lastPtView = new Point3d();
  private viewport: Viewport;
  private corners = [new Point3d(), new Point3d()];
  private shapePts = [new Point3d(), new Point3d(), new Point3d(), new Point3d(), new Point3d()];
  private lineHorzPts = [new Point3d(), new Point3d()];
  private lineVertPts = [new Point3d(), new Point3d()];
  private fillColor = ColorDef.from(0, 0, 255, 200);

  constructor(viewport: Viewport) {
    super();
    this.viewport = viewport;
  }

  public onModelEndDrag(ev: BeButtonEvent) { return this.onDataButtonDown(ev); }
  public onReinitialize() {
    this.haveFirstPoint = false;
    this.firstPtWorld.setZero();
    this.secondPtWorld.setZero();
  }

  public onModelMotion(ev: BeButtonEvent): void { this.doManipulation(ev, true); }
  public updateDynamics(ev: BeButtonEvent): void { this.doManipulation(ev, true); }

  public onDataButtonDown(ev: BeButtonEvent): boolean {
    if (this.haveFirstPoint) {
      this.secondPtWorld.setFrom(ev.point);
      this.doManipulation(ev, false);
      this.onReinitialize();
      this.viewport.invalidateDecorations();
    } else {
      this.firstPtWorld.setFrom(ev.point);
      this.secondPtWorld.setFrom(this.firstPtWorld);
      this.haveFirstPoint = true;
      this.lastPtView.setFrom(ev.viewPoint);
    }

    return true;
  }

  public onResetButtonUp(ev: BeButtonEvent): boolean {
    if (this.haveFirstPoint) {
      this.haveFirstPoint = false;
      return true;
    }
    return super.onResetButtonUp(ev);
  }

  public decorate(context: DecorateContext): void {
    const color = this.viewport.getContrastToBackgroundColor();
    if (this.haveFirstPoint) {
      const corners = this.computeWindowCorners();
      if (undefined === corners)
        return;

      this.shapePts[0].x = this.shapePts[3].x = corners[0].x;
      this.shapePts[1].x = this.shapePts[2].x = corners[1].x;
      this.shapePts[0].y = this.shapePts[1].y = corners[0].y;
      this.shapePts[2].y = this.shapePts[3].y = corners[1].y;
      this.shapePts[0].z = this.shapePts[1].z = this.shapePts[2].z = this.shapePts[3].z = corners[0].z;
      this.shapePts[4].setFrom(this.shapePts[0]);
      this.viewport.viewToWorldArray(this.shapePts);

      const graphic = context.createWorldOverlay();

      graphic.setBlankingFill(this.fillColor);
      graphic.addShape(this.shapePts);

      graphic.setSymbology(color, color, ViewHandleWeight.Thin);
      graphic.addLineString(this.shapePts);

      graphic.setSymbology(color, color, ViewHandleWeight.FatDot);
      graphic.addPointString([this.firstPtWorld]);

      context.addWorldOverlay(graphic.finish());
      return;
    }

    const gf = context.createViewOverlay();
    gf.setSymbology(color, color, ViewHandleWeight.Thin);

    const viewRect = this.viewport.viewRect;
    const cursorPt = this.lastPtView;
    cursorPt.z = 0;

    this.lineHorzPts[0].setFrom(cursorPt);
    this.lineHorzPts[1].setFrom(cursorPt);
    this.lineHorzPts[0].x = viewRect.left;
    this.lineHorzPts[1].x = viewRect.right;
    gf.addLineString(this.lineHorzPts);

    this.lineVertPts[0].setFrom(cursorPt);
    this.lineVertPts[1].setFrom(cursorPt);
    this.lineVertPts[0].y = viewRect.top;
    this.lineVertPts[1].y = viewRect.bottom;
    gf.addLineString(this.lineVertPts);

    context.addViewOverlay(gf.finish());
  }

  private computeWindowCorners(): Point3d[] | undefined {
    const vp = this.viewport;
    const corners = this.corners;

    corners[0].setFrom(this.firstPtWorld);
    corners[1].setFrom(this.secondPtWorld);
    vp.worldToViewArray(corners);

    const delta = corners[1].minus(corners[0]);
    if (delta.magnitudeXY() < 2.0)
      return undefined;

    const currentDelta = this.viewport.viewDelta;
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

  private doManipulation(ev: BeButtonEvent, inDynamics: boolean): void {
    this.secondPtWorld.setFrom(ev.point);
    if (inDynamics) {
      this.lastPtView.setFrom(ev.viewPoint);
      IModelApp.viewManager.invalidateDecorationsAllViews();
      return;
    }

    const corners = this.computeWindowCorners();
    if (!corners)
      return;

    let delta: Vector3d;
    const vp = this.viewport;
    const startFrust = vp.getWorldFrustum(scratchFrustum);
    vp.viewToWorldArray(corners);

    if (vp.view.is3d() && vp.view.isCameraOn()) {
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

    vp.animateFrustumChange(startFrust, vp.getFrustum(), ViewToolSettings.animationTime);
  }

  public onSingleFingerMove(ev: BeGestureEvent): boolean { IModelApp.toolAdmin.convertGestureMoveToButtonDownAndMotion(ev); return true; }
  public onEndGesture(ev: BeGestureEvent): boolean { IModelApp.toolAdmin.convertGestureEndToButtonUp(ev); return true; }
}

/** tool that handles gestures */
export class ViewGestureTool extends ViewManip {
  public static toolId = ""; // gesture tools are never registered
  protected startInfo: GestureInfo = new GestureInfo();
  protected numberTouches: number = 0;
  protected touches = [new Point2d(), new Point2d(), new Point2d()];
  protected centerNpc = new Point3d();
  constructor(ev: BeGestureEvent) {
    super(ev.viewport!, 0, true, false, false);
  }
  public onDataButtonDown(_ev: BeButtonEvent) { return false; }

  public doGesture(transform: Transform): boolean {
    const vp = this.viewport!;
    const frustum = vp.getFrustum(CoordSystem.Npc, false, scratchFrustum);
    frustum.multiply(transform);
    vp.npcToWorldArray(frustum.points);

    if (!vp.setupViewFromFrustum(frustum))
      return false;

    const view = vp.view;
    if (view.is3d() && view.isCameraOn()) {
      view.centerEyePoint();
      vp.setupFromView();
    }

    this.doUpdate(true);
    return true;
  }

  public endGesture(): boolean {
    this.clearTouchStopData();
    this.doUpdate(true);
    this.exitTool();
    return true;
  }

  public clearTouchStopData() { this.numberTouches = 0; }
  public saveTouchStopData(info: GestureInfo) {
    this.numberTouches = info.numberTouches;
    for (let i = 0; i < this.numberTouches; ++i)
      this.touches[i].setFrom(info.touches[i]);
  }

  public onStart(ev: BeGestureEvent) {
    this.clearTouchStopData();
    this.startInfo.copyFrom(ev.gestureInfo!);
  }
}

export class RotatePanZoomGestureTool extends ViewGestureTool {
  private allowZoom: boolean = true;
  private rotatePrevented: boolean = false;
  private doing2dRotation: boolean = false;
  private ballVector0 = new Vector3d();
  private lastPtView = new Point3d();
  private startPtWorld = new Point3d();
  private startPtView = new Point3d();
  private startTime: number = 0;
  private frustum = new Frustum();
  private is2dRotateGestureLimit = 350;   // milliseconds

  constructor(ev: BeGestureEvent, private allowRotate: boolean) {
    super(ev);
    this.onStart(ev);
    this.handleEvent(ev);
  }

  private is2dRotateGesture(ev: BeGestureEvent): boolean {
    if (!this.allowRotate || this.rotatePrevented)
      return false;

    if (this.doing2dRotation)
      return true;

    const vp = this.viewport!;
    const view = vp.view;
    const info = ev.gestureInfo!;
    if (view.allow3dManipulations() || info.numberTouches !== 2) {
      this.rotatePrevented = false;
      return false;
    }

    const startInfo = this.startInfo;
    const angleChange = Math.abs(this.getRotationFromStart(info).radians);
    const angularDistance = Math.abs(info.distance / 2.0 * Math.sin(angleChange));
    const zoomDistance = Math.abs(info.distance - startInfo.distance);

    const panDistance = startInfo.getViewPoint(vp).distance(info.getViewPoint(vp));

    if (angleChange > Math.PI / 10 || angularDistance > zoomDistance && angularDistance > panDistance * 0.75) {
      this.doing2dRotation = true;
      return true;
    }

    const timeDiff = Date.now() - this.startTime;
    this.rotatePrevented = timeDiff > this.is2dRotateGestureLimit;
    return false;
  }

  private is3dRotateGesture(ev: BeGestureEvent): boolean {
    return this.allowRotate && (1 === ev.gestureInfo!.numberTouches) && this.viewport!.view.allow3dManipulations();
  }

  private computeZoomRatio(info: GestureInfo): number {
    if (!this.allowZoom)
      return 1.0;

    let newDistance = info.distance;
    if (newDistance < 1.0)
      newDistance = 1.0;

    let startDistance = this.startInfo.distance;
    if (startDistance < 1.0)
      startDistance = 1.0;

    let zoomRatio = startDistance / newDistance;
    if (zoomRatio < 0.1)
      zoomRatio = 0.1;
    else if (zoomRatio > 10.0)
      zoomRatio = 10.0;

    if (info.numberTouches > 2 || (Math.abs(startDistance - newDistance) < this.viewport!.pixelsFromInches(0.125)))
      zoomRatio = 1.0;

    return zoomRatio;
  }

  private getRotationFromStart(info: GestureInfo): Angle {
    const currentTouches = info.touches;
    const startTouches = this.startInfo.touches;
    const startVec = new Vector2d(startTouches[1].x - startTouches[0].x, startTouches[1].y - startTouches[0].y);
    const currentVec = new Vector2d(currentTouches[1].x - currentTouches[0].x, currentTouches[1].y - currentTouches[0].y);
    return startVec.angleTo(currentVec);
  }

  private handle2dRotate(ev: BeGestureEvent): boolean {
    const vp = this.viewport!;

    //  All of the transforms and computation are relative to the original transform.
    if (!vp.setupViewFromFrustum(this.frustum))
      return true;

    const view = vp.view;
    const info = ev.gestureInfo!;
    const currentTouches = info.touches;
    const startTouches = this.startInfo.touches;

    const startPt0 = vp.viewToWorld(new Point3d(startTouches[0].x, startTouches[0].y, 0));
    const currPt0 = vp.viewToWorld(new Point3d(currentTouches[0].x, currentTouches[0].y, 0));
    const diffWorld = startPt0.minus(currPt0);
    const translateTransform = Transform.createTranslation(diffWorld);

    const radians = this.getRotationFromStart(info);
    const matrix = RotMatrix.createRotationAroundVector(view.getZVector(), radians)!;
    const rotationTransform = Transform.createFixedPointAndMatrix(currPt0, matrix);
    let transform = translateTransform.multiplyTransformTransform(rotationTransform);

    const zoomRatio = this.computeZoomRatio(info);
    const scaleTransform = Transform.createScaleAboutPoint(startPt0, zoomRatio, scratchTransform1);

    transform = scaleTransform.multiplyTransformTransform(transform, scratchTransform2);
    const frust = this.frustum.transformBy(transform);

    vp.setupViewFromFrustum(frust);
    this.saveTouchStopData(info);
    this.doUpdate(true);

    this.lastPtView.setFrom(currPt0);
    return true;
  }

  private handle3dRotate(ev: BeGestureEvent) {
    if (this.lastPtView.isAlmostEqual(ev.viewPoint, 2.0))
      return true;

    const vp = this.viewport!;
    const currPt = ev.viewPoint.clone();
    if (this.startPtView.isAlmostEqual(currPt, 2.0))
      currPt.setFrom(this.startPtView);

    this.lastPtView.setFrom(currPt);

    if (!vp.setupViewFromFrustum(this.frustum))
      return true;

    const viewRect = vp.viewRect;
    const xExtent = viewRect.width;
    const yExtent = viewRect.height;
    const xDelta = currPt.x - this.startPtView.x;
    const yDelta = currPt.y - this.startPtView.y;

    const xAxis = ViewToolSettings.preserveWorldUp ? Vector3d.unitZ() : vp.rotMatrix.getRow(1);
    const yAxis = vp.rotMatrix.getRow(0);
    const xRMatrix = (0.0 !== xDelta) ? RotMatrix.createRotationAroundVector(xAxis, Angle.createRadians(Math.PI / (xExtent / xDelta)))! : RotMatrix.identity;
    const yRMatrix = (0.0 !== yDelta) ? RotMatrix.createRotationAroundVector(yAxis, Angle.createRadians(Math.PI / (yExtent / yDelta)))! : RotMatrix.identity;
    const worldRMatrix = yRMatrix.multiplyMatrixMatrix(xRMatrix);
    const worldTransform = Transform.createFixedPointAndMatrix(this.startPtWorld, worldRMatrix);
    const frustum = this.frustum.transformBy(worldTransform, scratchFrustum);

    if (!vp.setupViewFromFrustum(frustum))
      return true;

    this.saveTouchStopData(ev.gestureInfo!);
    this.doUpdate(true);
    return true;
  }

  public onStart(ev: BeGestureEvent): void {
    super.onStart(ev);

    const vp = this.viewport!;
    vp.getWorldFrustum(this.frustum);

    this.doing2dRotation = this.rotatePrevented = false;
    this.startPtWorld.setFrom(ev.point);
    this.startPtView.setFrom(ev.viewPoint);
    this.updateTargetCenter();
    this.synchViewBallInfo();
    this.viewPtToSpherePt(this.startPtView, true, this.ballVector0);

    if (vp.isCameraOn()) {
      const targetCenterView = vp.worldToView(this.targetCenterWorld);
      this.startPtView.z = targetCenterView.z;
      vp.viewToWorld(this.startPtView, this.startPtWorld);
    }

    this.lastPtView.setFrom(this.startPtView);
    this.startTime = Date.now();
    const visiblePoint = vp.determineNearestVisibleGeometryPoint(ev.rawPoint, 20.0);
    if (!visiblePoint)
      return;

    this.startPtWorld.setFrom(visiblePoint);
    vp.worldToView(this.startPtWorld, this.startPtView);
    this.lastPtView.setFrom(this.startPtView);
  }

  protected handleEvent(ev: BeGestureEvent): boolean {
    if (this.is3dRotateGesture(ev))
      return this.handle3dRotate(ev);

    if (this.is2dRotateGesture(ev))
      return this.handle2dRotate(ev);

    const vp = this.viewport!;
    const info = ev.gestureInfo!;
    const zoomRatio = this.computeZoomRatio(info);

    // reset frustum to original position
    if (!vp.setupViewFromFrustum(this.frustum))
      return true;

    let zoomCenter = (vp.view.allow3dManipulations() ? vp.determineNearestVisibleGeometryPoint(ev.rawPoint, 20.0) : undefined);
    if (undefined === zoomCenter)
      zoomCenter = ev.point;

    vp.zoom(ev.point, zoomRatio);
    this.saveTouchStopData(info);
    this.doUpdate(true);

    return true;
  }

  public onMultiFingerMove(ev: BeGestureEvent): boolean {
    const info = ev.gestureInfo!;
    if (info.numberTouches !== this.startInfo.numberTouches) {
      this.onStart(ev);
      return true;
    }
    return this.handleEvent(ev);
  }

  public onSingleFingerMove(ev: BeGestureEvent): boolean { return this.onMultiFingerMove(ev); }
  public onEndGesture(_ev: BeGestureEvent): boolean {
    this.clearTouchStopData();
    return this.endGesture();
  }
}

export class ViewLookTool extends ViewManip {
  public static toolId = "View.Look";
  constructor(vp: Viewport) {
    super(vp, ViewHandleType.ViewLook, true, false, true);
  }
}

export class ViewScrollTool extends ViewManip {
  public static toolId = "View.Scroll";
  constructor(vp: Viewport) {
    super(vp, ViewHandleType.ViewScroll, true, false, true);
  }
}

export class ViewUndoTool extends ViewTool {
  public static toolId = "View.Undo";
  private viewport: Viewport;

  constructor(vp: Viewport) { super(); this.viewport = vp; }

  public onPostInstall() {
    this.viewport.doUndo(ViewToolSettings.animationTime);
    this.exitTool();
  }
}

export class ViewRedoTool extends ViewTool {
  public static toolId = "View.Redo";
  private viewport: Viewport;

  constructor(vp: Viewport) { super(); this.viewport = vp; }

  public onPostInstall() {
    this.viewport.doRedo(ViewToolSettings.animationTime);
    this.exitTool();
  }
}

export class ViewToggleCameraTool extends ViewTool {
  public static toolId = "View.ToggleCamera";
  private viewport: Viewport;

  constructor(viewport: Viewport) { super(); this.viewport = viewport; }

  public onInstall(): boolean { return (undefined !== this.viewport && this.viewport.view.is3d() && this.viewport.view.allow3dManipulations()); }

  public onPostInstall(): void {
    if (this.viewport.isCameraOn())
      (this.viewport.view as ViewState3d).turnCameraOff();
    else
      this.viewport.turnCameraOn();

    this.viewport.synchWithView(true);
    this.exitTool();
  }
}

// Tool currently only used for debugging purposes.
// Users of imodeljs-core have the ability to set these flags from their app directly and do not need this ViewTool.
export class ViewChangeRenderModeTool extends ViewTool {
  public static toolId = "View.ChangeRenderMode";
  private viewport: Viewport;
  // REFERENCE to app's map of rendering options to true/false values (i.e. - whether or not to display skybox, groundplane, etc.)
  private renderOptions: Map<string, boolean>;
  // REFERENCE to app's menu for changing render modes
  private renderMenu: HTMLElement;
  private renderMode: RenderMode;

  constructor(viewport: Viewport, renderOptionsMap: Map<string, boolean>, renderMenuDialog: HTMLElement, mode: RenderMode) {
    super();
    this.viewport = viewport;
    this.renderOptions = renderOptionsMap;
    this.renderMenu = renderMenuDialog;
    this.renderMode = mode;
  }

  // We want changes to happen immediately when checking or unchecking an option
  public onPostInstall() {
    const viewflags = ViewFlags.createFrom(this.viewport.viewFlags);
    viewflags.renderMode = this.renderMode;
    viewflags.acsTriad = this.renderOptions.get("ACSTriad")!;
    viewflags.fill = this.renderOptions.get("fill")!;
    viewflags.grid = this.renderOptions.get("grid")!;
    viewflags.textures = this.renderOptions.get("textures")!;
    viewflags.visibleEdges = this.renderOptions.get("visibleEdges")!;
    viewflags.materials = this.renderOptions.get("materials")!;
    viewflags.monochrome = this.renderOptions.get("monochrome")!;
    viewflags.constructions = this.renderOptions.get("constructions")!;
    viewflags.transparency = this.renderOptions.get("transparency")!;
    viewflags.hiddenEdges = this.renderOptions.get("hiddenEdges")!;
    viewflags.weights = this.renderOptions.get("weights")!;
    viewflags.styles = this.renderOptions.get("styles")!;

    const lights = this.renderOptions.get("lights")!;
    viewflags.sourceLights = lights;
    viewflags.solarLight = lights;
    viewflags.cameraLights = lights;

    // Now handle environment
    if (this.viewport.view.is3d()) {
      const view = this.viewport.view as ViewState3d;
      const displayStyle = view.getDisplayStyle3d();
      const env = displayStyle.getEnvironment();
      env.ground.display = this.renderOptions.get("groundplane")!; // Changes directly within displaystyle
      env.sky.display = this.renderOptions.get("skybox")!;  // Changes directly within displaystyle
      displayStyle.setEnvironment(env);
    }

    this.viewport.view.viewFlags = viewflags;
    this.viewport.sync.invalidateController();
  }

  public onDataButtonDown(_ev: BeButtonEvent): boolean {
    this.renderMenu.style.display = "none";
    this.exitTool();
    return true;
  }
}
