/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ToolAdmin } from "./ToolAdmin";
import { Tool, ButtonEvent, Cursor, WheelMouseEvent, CoordSource } from "./Tool";
import { Viewport, CoordSystem } from "../Viewport";
import { Point3d, Vector3d, RotMatrix, Transform, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { Frustum, NpcCenter, Npc, MarginPercent, ViewStatus, ViewState3d } from "../../common/ViewState";
import { BeDuration } from "@bentley/bentleyjs-core/lib/Time";
import { Angle } from "@bentley/geometry-core/lib/Geometry";

const toolAdmin = ToolAdmin.instance;
const scratchButtonEvent = new ButtonEvent();
const scratchFrustum = new Frustum();
const scratchTransform1 = Transform.createIdentity();
const scratchTransform2 = Transform.createIdentity();
const scratchRotMatrix1 = new RotMatrix();
const scratchRotMatrix2 = new RotMatrix();
const scratchPoint3d1 = new Point3d();
const scratchPoint3d2 = new Point3d();
const scratchVector3d1 = new Vector3d();
const scratchVector3d2 = new Vector3d();

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

export const enum HitPriority {
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
  dynamicRotationSphere: false,
  preserveWorldUp: true,
  fitExpandsClipping: true,
  walkEnforceZUp: true,
  fitModes: 0,            // ALL
  mode3dInput: 0,         // WALK
  viewBallRadius: 0.35,
  walkVelocity: 3.5,      // in m/sec
  walkCameraAngle: Angle.createDegrees(75.6),  // in degrees
  animationTime: BeDuration.fromSeconds(260),
  animateZoom: false,
  minDistanceToSurface: 2,
  pickSize: 13,
  zoomToElement: false,
};

// tslint:disable:no-empty
export abstract class ViewTool extends Tool {
  public inDynamicUpdate = false;
  public beginDynamicUpdate() { this.inDynamicUpdate = true; }
  public endDynamicUpdate() { this.inDynamicUpdate = false; }
  public installToolImplementation() {
    if (!toolAdmin.onInstallTool(this))
      return ViewStatus.InvalidViewport;

    toolAdmin.setViewTool(undefined);
    toolAdmin.startViewTool();
    toolAdmin.setViewTool(this);
    toolAdmin.onPostInstallTool(this);
    return ViewStatus.Success;
  }

  public onResetButtonUp(_ev: ButtonEvent) { this.exitTool(); return true; }

  /** Do not override. */
  public exitTool() { toolAdmin.exitViewTool(); }
}

export abstract class ViewingToolHandle {
  constructor(public viewTool: ViewManip) { }
  public onReinitialize() { }
  public focusOut() { }
  public noMotion(_ev: ButtonEvent) { return false; }
  public motion(_ev: ButtonEvent) { return false; }
  public checkOneShot() { return true; }
  public getHandleCursor() { return Cursor.Default; }
  public abstract doManipulation(ev: ButtonEvent, inDynamics: boolean): boolean;
  public abstract firstPoint(ev: ButtonEvent): boolean;
  public abstract testHandleForHit(ptScreen: Point3d): { distance: number, priority: HitPriority } | undefined;
  public abstract get handleType(): ViewHandleType;
  public focusIn() { toolAdmin.setViewCursor(this.getHandleCursor()); }
}

export class ViewHandleArray {
  public handles: ViewingToolHandle[];
  public viewport: Viewport;
  public focus: number;
  public focusDrag: boolean;
  public hitHandleIndex: number;

  constructor(public viewTool: ViewManip) {
    this.handles = [];
    this.empty();
  }

  public empty() {
    this.focus = -1;
    this.focusDrag = false;
    this.hitHandleIndex = -1;
    this.handles.length = 0;
  }

  public get count() { return this.handles.length; }
  public get hitHandle() { return this.getByIndex(this.hitHandleIndex); }
  public get focusHandle() { return this.getByIndex(this.focus); }
  public add(handle: ViewingToolHandle) { this.handles.push(handle); }
  public getByIndex(index: number): ViewingToolHandle | undefined { return (index >= 0 && index < this.count) ? this.handles[index] : undefined; }
  public focusHitHandle() { this.setFocus(this.hitHandleIndex); }

  public testHit(ptScreen: Point3d, forced = ViewHandleType.None): boolean {
    this.hitHandleIndex = -1;
    let minDistance = 0.0;
    let minDistValid = false;
    let highestPriority = HitPriority.Low;
    let nearestHitHandle: ViewingToolHandle | undefined;

    for (let i = 0; i < this.count; ++i) {
      const handle = this.handles[i];
      if (!handle)
        continue;

      if (forced !== ViewHandleType.None) {
        if (handle.handleType === forced) {
          this.hitHandleIndex = i;
          return true;
        }
      } else {
        const hit = handle.testHandleForHit(ptScreen);
        if (!hit)
          continue;

        if (hit.priority >= highestPriority) {
          if (hit.priority > highestPriority)
            minDistValid = false;

          highestPriority = hit.priority;
          if (!minDistValid || (hit.distance < minDistance)) {
            minDistValid = true;
            minDistance = hit.distance;
            nearestHitHandle = handle;
            this.hitHandleIndex = i;
          }
        }
      }
    }

    return nearestHitHandle !== undefined;
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
  }

  public onReinitialize() { this.handles.forEach((handle) => { if (handle) handle.onReinitialize(); }); }

  /** determine whether a handle of a specific type exists */
  public hasHandle(handleType: ViewHandleType) {
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

  public motion(ev: ButtonEvent): boolean {
    this.handles.forEach((handle) => { if (handle) handle.motion(ev); });
    return true;
  }
}

export class ViewManip extends ViewTool {
  public viewport?: Viewport;
  public viewHandles: ViewHandleArray;
  public frustumValid: boolean;
  public alwaysLeaveLastView: boolean;
  public ballRadius: number;          // screen coords
  public lastPtScreen: Point3d;
  public targetCenterWorld: Point3d;
  public worldUpVector: Vector3d;
  public isDragging: boolean;
  public isDragOperation: boolean;
  public stoppedOverHandle: boolean;
  public wantMotionStop: boolean;
  public targetCenterValid: boolean;
  public supportsOrientationEvents: boolean;
  public nPts: number;
  public forcedHandle: ViewHandleType;
  public lastFrustum: Frustum;

  constructor(viewport: Viewport, public handleMask: number, public isOneShot: boolean, public scrollOnNoMotion: boolean,
    public isDragOperationRequired: boolean = false) {
    super();
    this.viewport = viewport;
    this.wantMotionStop = true;
    this.isDragOperation = false;
    this.targetCenterValid = false;
    this.lastPtScreen = new Point3d();
    this.targetCenterWorld = new Point3d();
    this.ballRadius = 0.0;
    this.worldUpVector = new Vector3d();
    this.forcedHandle = ViewHandleType.None;
    this.lastFrustum = new Frustum();
    this.viewHandles = new ViewHandleArray(this);
    if (handleMask & ViewHandleType.ViewPan) this.viewHandles.add(new ViewPan(this));
    if (handleMask & ViewHandleType.Rotate) { this.synchViewBallInfo(true); this.viewHandles.add(new ViewRotate(this)); }
    if (handleMask & ViewHandleType.ViewWalk) this.viewHandles.add(new ViewWalk(this));

    this.onReinitialize();
  }

  public get toolId(): string {
    const handleMask = this.handleMask;
    if (handleMask & (ViewHandleType.Rotate | ViewHandleType.TargetCenter)) return "View.Rotate";
    if (handleMask & ViewHandleType.ViewPan) return "View.Pan";
    if (handleMask & ViewHandleType.ViewScroll) return "View.Scroll";
    if (handleMask & ViewHandleType.ViewZoom) return "View.Zoom";
    if (handleMask & ViewHandleType.ViewWalk) return "View.Walk";
    if (handleMask & ViewHandleType.ViewWalkMobile) return "View.WalkMobile";
    if (handleMask & ViewHandleType.ViewFly) return "View.Fly";
    if (handleMask & ViewHandleType.ViewLook) return "View.Look";
    return "";
  }

  public onReinitialize(): void {
    toolAdmin.gesturePending = false;
    if (this.viewport) {
      this.viewport.synchWithView(true);
      this.viewHandles.setFocus(-1);
    }
    this.nPts = 0;
    this.isDragging = false;
    this.inDynamicUpdate = false;
    this.frustumValid = false;
    this.viewHandles.onReinitialize();
  }

  public onDataButtonDown(ev: ButtonEvent) {
    if (0 === this.nPts && this.isDragOperationRequired && !this.isDragOperation)
      return false;

    switch (this.nPts) {
      case 0:
        if (this.processFirstPoint(ev))
          this.nPts = 1;
        break;
      case 1:
        this.nPts = 2;
        break;
    }

    if (this.nPts > 1) {
      if (this.processPoint(ev, false) && this.isOneShot)
        this.exitTool();
      else
        this.onReinitialize();
    }

    return true;
  }

  public onDataButtonUp(_ev: ButtonEvent): boolean {
    if (this.nPts <= 1 && this.isDragOperationRequired && !this.isDragOperation && this.isOneShot)
      this.exitTool();

    return false;
  }

  // Just let the idle tool handle this...
  public onMiddleButtonDown(_ev: ButtonEvent): boolean { return false; }

  public onMiddleButtonUp(_ev: ButtonEvent) {
    if (this.nPts <= 1 && !this.isDragOperation && this.isOneShot)
      this.exitTool();

    return false;
  }

  public onMouseWheel(inputEv: WheelMouseEvent): boolean {
    const ev = inputEv.clone();

    // If the rotate is active, the mouse wheel should work as if the cursor is at the target center
    if ((this.handleMask & ViewHandleType.Rotate)) {
      ev.point = this.targetCenterWorld;
      ev.coordsFrom = CoordSource.Precision; // don't want raw point used...
    }

    toolAdmin.processMouseWheelEvent(ev, false);
    this.doUpdate(true);
    return true;
  }

  public onModelStartDrag(ev: ButtonEvent): boolean {
    this.isDragOperation = true;
    this.stoppedOverHandle = false;

    toolAdmin.gesturePending = false;
    if (0 === this.nPts)
      this.onDataButtonDown(ev);

    return true;
  }

  public onModelEndDrag(ev: ButtonEvent): boolean {
    this.isDragOperation = false;
    return 0 === this.nPts || this.onDataButtonDown(ev);
  }

  public onModelMotion(ev: ButtonEvent): void {
    this.stoppedOverHandle = false;
    if (0 === this.nPts && this.viewHandles.testHit(ev.viewPoint))
      this.viewHandles.focusHitHandle();

    if (0 !== this.nPts)
      this.processPoint(ev, true);

    this.viewHandles.motion(ev);
  }

  public onModelMotionStopped(ev: ButtonEvent): void {
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

  public onModelNoMotion(ev: ButtonEvent) {
    if (0 === this.nPts || !ev.viewport)
      return;

    const hitHandle = this.viewHandles.hitHandle;
    if (hitHandle && hitHandle.noMotion(ev))
      this.doUpdate(false);
  }

  public onCleanup(): void {
    let restorePrevious = false;

    if (this.inDynamicUpdate) {
      this.endDynamicUpdate();
      restorePrevious = !this.alwaysLeaveLastView;
    }

    const vp = this.viewport;
    if (vp) {
      vp.synchWithView(true);
      if (restorePrevious)
        vp.applyPrevious(BeDuration.fromSeconds(0));
      vp.invalidateDecorations();
    }

    this.viewHandles.empty();
    this.viewport = undefined;
  }

  public isSameFrustum() {
    const frust = this.viewport!.getWorldFrustum(scratchFrustum);
    if (this.frustumValid && frust.equals(this.lastFrustum))
      return true;

    frust.clone(this.lastFrustum);
    this.frustumValid = true;
    return false;
  }

  /** Get the geometric center of the union of the ranges of all selected elements. */
  private getSelectedElementCenter(): Point3d | undefined {
    // DgnElementIdSet const& elemSet = SelectionSetManager:: GetManager().GetElementIds();

    // if (0 == elemSet.size())
    //   return ERROR;

    // DRange3d range = DRange3d:: NullRange();
    // DgnDbR dgnDb = SelectionSetManager:: GetManager().GetDgnDbR();

    // for (DgnElementId elemId : elemSet)
    // {
    //   DgnElementCP el = dgnDb.Elements().FindLoadedElement(elemId); // Only care about already loaded elements...

    //   if (NULL == el)
    //     continue;

    //   DPoint3d origin;
    //   GeometrySourceCP geom = el -> ToGeometrySource();
    //   if (geom && geom -> HasGeometry()) {
    //     DRange3d elRange = geom -> CalculateRange3d();

    //     origin.Interpolate(elRange.low, 0.5, elRange.high);
    //     range.Extend(origin);
    //   }
    // }

    // if (range.IsNull())
    //   return ERROR;

    // center.Interpolate(range.low, 0.5, range.high);
    // return SUCCESS;
    return undefined;
  }

  public updateTargetCenter() {
    const vp = this.viewport;
    if (!vp)
      return;

    if (this.targetCenterValid) {
      // React to AccuDraw compass being moved using "O" shortcut or tentative snap...
      if (this.isDragging)
        return;

      // DPoint3d  center = this.getTargetCenterWorld();
      // AccuDrawR accudraw = AccuDraw:: GetInstance();

      // if (accudraw.IsActive()) {
      //   DPoint3d    testPoint;
      //   accudraw.GetOrigin(testPoint);
      //   // Redefine target center if changed...world-locked if moved by user after tool starts...
      //   if (!testPoint.IsEqual(center, 1.0e-10))
      //     SetTargetCenterWorld(& testPoint, true);
      // }
      // else if (TentativePoint:: GetInstance().IsActive())
      // {
      //   // Clear current tentative, i.e. no datapoint to accept...
      //   DPoint3d    testPoint = * TentativePoint:: GetInstance().GetPoint();

      //   // Redefine target center if changed...world-locked if moved by user after tool starts...
      //   if (!testPoint.IsEqual(center, 1.0e-10))
      //     SetTargetCenterWorld(& testPoint, true);

      //   TentativePoint:: GetInstance().Clear(true);

      //   // NOTE: AccuDraw won't normally grab focus because it's disabled for viewing tools...
      //   AccuDrawShortcuts:: RequestInputFocus();
      // }

      return;
    }
    // TentativePoint & tentPoint = TentativePoint:: GetInstance();
    // // Define initial target center for view ball...
    // if (tentPoint.IsActive()) {
    //   SetTargetCenterWorld(tentPoint.GetPoint(), true);
    //   return;
    // }

    // if (tentPoint.IsSnapped() || AccuSnap:: GetInstance().IsHot())
    // {
    //   SetTargetCenterWorld(TentativeOrAccuSnap:: GetCurrentPoint(), true);
    //   return;
    // }

    let center = this.getSelectedElementCenter();
    if (center && this.isPointVisible(center)) {
      this.setTargetCenterWorld(center, true);
      return;
    }

    center = vp.viewCmdTargetCenter;

    if (center && this.isPointVisible(center)) {
      this.setTargetCenterWorld(center, true);
      return;
    }

    center = scratchPoint3d1;
    if (!vp.view.allow3dManipulations()) {
      vp.npcToWorld(NpcCenter, center);
      center.z = 0.0;
    } else {
      vp.determineDefaultRotatePoint(center);
    }

    this.setTargetCenterWorld(center, false);
  }

  public updateWorldUpVector(initialSetup: boolean) {
    if (!initialSetup)
      return;

    this.worldUpVector.x = 0.0;
    this.worldUpVector.y = 0.0;
    this.worldUpVector.z = 1.0;
  }

  public processFirstPoint(ev: ButtonEvent) {
    const forcedHandle = this.forcedHandle;
    this.forcedHandle = ViewHandleType.None;
    this.frustumValid = false;

    if (this.viewHandles.testHit(ev.viewPoint, forcedHandle)) {
      this.isDragging = true;
      this.viewHandles.focusHitHandle();
      const handle = this.viewHandles.hitHandle;
      if (handle && !handle.firstPoint(ev))
        return false;
    }

    return true;
  }

  public processPoint(ev: ButtonEvent, inDynamics: boolean) {
    const hitHandle = this.viewHandles.hitHandle;
    if (!hitHandle)
      return true;

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

  public doUpdate(_abortOnButton: boolean) {
    // we currently have no built-in support for dynamics, therefore nothing to update.
  }

  public setTargetCenterWorld(pt: Point3d, snapOrPrecision: boolean) {
    this.targetCenterWorld.setFrom(pt);
    this.targetCenterValid = true;
    const vp = this.viewport;
    if (!vp)
      return;

    if (!vp.view.allow3dManipulations())
      this.targetCenterWorld.z = 0.0;

    vp.viewCmdTargetCenter = (snapOrPrecision ? pt : undefined);

    const viewPt = vp.worldToView(this.targetCenterWorld, scratchPoint3d1);
    const ev = scratchButtonEvent;
    ev.initEvent(this.targetCenterWorld, this.targetCenterWorld, viewPt, vp, CoordSource.User, 0);
    toolAdmin.setAdjustedDataPoint(ev);
    ev.reset();
  }

  public invalidateTargetCenter() { this.targetCenterValid = false; }

  public isPointVisible(testPt: Point3d): boolean {
    const vp = this.viewport;
    if (!vp)
      return false;
    const testPtView = vp.worldToView(testPt);
    const frustum = vp.getFrustum(CoordSystem.Screen, false, scratchFrustum);

    const screenRange = scratchPoint3d1;
    screenRange.x = frustum.points[Npc._000].distance(frustum.points[Npc._100]);
    screenRange.y = frustum.points[Npc._000].distance(frustum.points[Npc._010]);
    screenRange.z = frustum.points[Npc._000].distance(frustum.points[Npc._001]);

    return (!((testPtView.x < 0 || testPtView.x > screenRange.x) || (testPtView.y < 0 || testPtView.y > screenRange.y)));
  }

  public static fitView(viewport: Viewport, doUpdate: boolean, marginPercent?: MarginPercent) {
    const range = viewport.computeViewRange();
    const aspect = viewport.viewRect.aspect;
    const before = viewport.getWorldFrustum(scratchFrustum);

    viewport.view.lookAtViewAlignedVolume(range, aspect, marginPercent);
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

    this.targetCenterValid = false;
    vp.synchWithView(false);
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
    vp.setupFromFrustum(frust);
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

  private synchViewBallInfo(initialSetup: boolean): void {
    const frustum = this.viewport!.getFrustum(CoordSystem.Screen, false, scratchFrustum);
    const screenRange = scratchPoint3d1;
    screenRange.set(
      frustum.points[Npc._000].distance(frustum.points[Npc._100]),
      frustum.points[Npc._000].distance(frustum.points[Npc._010]),
      frustum.points[Npc._000].distance(frustum.points[Npc._001]));

    this.ballRadius = (((screenRange.x < screenRange.y) ? screenRange.x : screenRange.y) * ViewToolSettings.viewBallRadius);
    this.updateTargetCenter();
    this.updateWorldUpVector(initialSetup);
  }
}

/** ViewingToolHandle for performing the "pan view" operation */
class ViewPan extends ViewingToolHandle {
  private anchorPt: Point3d = new Point3d();
  private lastPtNpc: Point3d = new Point3d();
  public get handleType() { return ViewHandleType.ViewPan; }
  public getHandleCursor() { return this.viewTool.isDragging ? Cursor.ClosedHand : Cursor.OpenHand; }

  public doManipulation(ev: ButtonEvent, _inDynamics: boolean) {
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

  public firstPoint(ev: ButtonEvent) {
    const vp = ev.viewport!;
    this.anchorPt.setFrom(ev.point);

    // if the camera is on, we need to find the element under the starting point to get the z
    if (CoordSource.User === ev.coordsFrom && vp.isCameraOn()) {
      const depthIntersection = vp.pickDepthBuffer(ev.viewPoint);
      if (depthIntersection) {
        this.anchorPt.setFrom(depthIntersection);
      } else {
        const firstPtNpc = vp.worldToNpc(this.anchorPt);
        firstPtNpc.z = vp.getFocusPlaneNpc();
        this.anchorPt = vp.npcToWorld(firstPtNpc, this.anchorPt);
      }
    }

    this.viewTool.beginDynamicUpdate();
    return true;
  }

  public onReinitialize() {
    const vha = this.viewTool.viewHandles.hitHandle;
    if (vha === this)
      toolAdmin.setViewCursor(this.getHandleCursor());
  }

  public testHandleForHit(_ptScreen: Point3d) { return { distance: 0.0, priority: HitPriority.Low }; }

  public doPan(newPtWorld: Point3d) {
    const vp = this.viewTool.viewport!;
    const view = vp.view;
    const dist = newPtWorld.vectorTo(this.anchorPt);

    if (view.is3d()) {
      view.moveCameraWorld(dist);
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
  public getHandleCursor() { return Cursor.Rotate; }

  public testHandleForHit(ptScreen: Point3d) {
    const tool = this.viewTool;
    const targetPt = tool.viewport!.worldToView(tool.targetCenterWorld);
    const dist = targetPt.distanceXY(ptScreen);
    return { distance: dist, priority: HitPriority.Normal };
  }

  public firstPoint(ev: ButtonEvent) {
    if (toolAdmin.gesturePending)
      return false;

    const tool = this.viewTool;
    const vp = tool.viewport!;

    const pickPt = ev.rawPoint; // Use raw point when AccuDraw is not active, don't want tentative location...
    // if (accudraw.IsActive()) {
    // DPoint3d    adrawOrigin;
    // RotMatrix   adrawMatrix;

    // accudraw.GetOrigin(adrawOrigin);
    // accudraw.GetRotation(adrawMatrix);

    // pickPt = pickPtOrig = * ev.GetPoint(); // Use adjusted point when AccuDraw is active...

    // DVec3d      viewZWorld;
    // DPoint3d    distWorld = pickPt;

    // // Lock to the construction plane
    // if (viewport -> IsCameraOn())
    //   viewZWorld.DifferenceOf(distWorld, viewport -> GetCamera().GetEyePoint());
    // else
    //   viewport -> GetRotMatrix().GetRow(viewZWorld, 2);

    // DVec3d      adrawZWorld;
    // DPoint3d    pickPt;

    // adrawMatrix.GetRow(adrawZWorld, 2);
    // LegacyMath:: Vec:: LinePlaneIntersect(& distWorld, & distWorld, & viewZWorld, & adrawOrigin, & adrawZWorld, false);
    // pickPt = distWorld;

    // uint32_t    flags = ACCUDRAW_AlwaysSetOrigin | ACCUDRAW_SetModePolar | ACCUDRAW_FixedOrigin;
    // DVec3d      adrawX, adrawY, adrawZ;

    // if (adrawX.NormalizedDifference(pickPt, activeOrg) > mgds_fc_epsilon) {
    //   adrawMatrix.GetRow(adrawZ, 2);
    //   adrawY.CrossProduct(adrawZ, adrawX);
    //   adrawMatrix.InitFromRowVectors(adrawX, adrawY, adrawZ);
    //   adrawMatrix.NormalizeRowsOf(adrawMatrix, adrawZWorld);

    //   flags |= ACCUDRAW_SetRMatrix;
    // }

    // accudraw.SetContext((AccuDrawFlags) flags, & activeOrg, (DVec3dP) & adrawMatrix);

    const viewPt = vp.worldToView(pickPt);
    tool.viewPtToSpherePt(viewPt, true, this.ballVector0);

    vp.worldToNpc(pickPt, this.firstPtNpc);
    this.lastPtNpc.setFrom(this.firstPtNpc);

    vp.getWorldFrustum(this.activeFrustum);
    this.frustum.setFrom(this.activeFrustum);

    tool.beginDynamicUpdate();
    return true;
  }

  public doManipulation(ev: ButtonEvent, _inDynamics: boolean): boolean {
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
    else if (!viewport.setupFromFrustum(this.frustum))
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
      const xAxis = ViewToolSettings.preserveWorldUp ? this.viewTool.worldUpVector.clone() : viewport.rotMatrix.getRow(1);

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
    const worldTransform = Transform.createFixedPointAndMatrix(worldOrigin, worldMatrix!);
    const frustum = this.frustum.clone();
    frustum.multiply(worldTransform);
    this.viewTool.viewport!.setupFromFrustum(frustum);
  }
}

// class WalkDecoration {
//   constructor(parentElement, origin, color) {
//     this.parentElement = parentElement;

//     const ruleColor = '1px solid ' + Cesium.defaultValue(color, 'white');
//     const halfLen = 7;
//     const fullLen = halfLen * 2 + 1;

//     const hor = document.createElement('div');
//     hor.className = 'bim-overlay-box-rule-horizontal';
//     this.hor = hor;
//     const style = hor.style;
//     style.height = '0px';
//     style.width = fullLen + 'px';
//     style.top = origin.y + 'px';
//     style.left = (origin.x - halfLen) + 'px';
//     style.borderBottom = ruleColor;
//     parentElement.appendChild(hor);

//     const ver = document.createElement('div');
//     ver.className = 'bim-overlay-box-rule-vertical';
//     this.ver = ver;
//     style = ver.style;
//     style.width = '0px';
//     style.height = fullLen + 'px';
//     style.left = origin.x + 'px';
//     style.top = (origin.y - halfLen) + 'px';
//     style.borderLeft = ruleColor;
//     parentElement.appendChild(ver);
//   }
//   public destroy() {
//      if (!this.destroyed) {
//        this.destroyed = true;
//        this.parentElement.removeChild(this.hor);
//        this.parentElement.removeChild(this.ver);
//     }
//   }
// }

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
    forward.scale(-1); // positive z is out of the screen, but we want direction into the screen
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
    const yawAngle = Angle.createRadians(yawRate * this.deltaTime);
    const pitchAngle = Angle.createRadians(this.modifyPitchAngleToPreventInversion(pitchRate * this.deltaTime));
    const angles = new YawPitchRollAngles(yawAngle, pitchAngle);
    const rMatrix = vp.rotMatrix.multiplyMatrixMatrix(angles.toRotMatrix(scratchRotMatrix1), scratchRotMatrix2);
    return Transform.createFixedPointAndMatrix(view.getEyePoint(), rMatrix, result);
  }

  public generateTranslationTransform(velocity: Vector3d, isConstrainedToXY: boolean, result?: Transform) {
    const rMatrix = this.viewport.rotMatrix;
    const xDir = rMatrix.getRow(0);
    const yDir = rMatrix.getRow(1);
    const zDir = this.getViewDirection();

    if (isConstrainedToXY) {
      const up = this.getWorldUp();
      const cross = up.crossProduct(zDir);
      cross.crossProduct(up, zDir);
      zDir.normalize();
    }

    xDir.scale(velocity.x * this.deltaTime, xDir);
    yDir.scale(velocity.y * this.deltaTime, yDir);
    zDir.scale(velocity.z * this.deltaTime, zDir);

    xDir.plus(yDir, xDir).plus(zDir, xDir);
    return Transform.createTranslation(xDir, result);
  }

  public moveAndLook(linearVelocity: Vector3d, angularVelocityX: number, angularVelocityY: number, isConstrainedToXY: boolean): void {
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

  private tryOrientationEvent(_forward: Vector3d, _ev: ButtonEvent): { eventsEnabled: boolean, result: OrientationResult } {
    // ###TODO: support orientation events?
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
  public testHandleForHit(_ptScreen: Point3d) { return { distance: 0.0, priority: HitPriority.Low }; }

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
    const state = toolAdmin.currentInputState;
    if (state.isShiftDown || !this.viewTool.viewport!.isCameraOn())
      return NavigateMode.Pan;
    return state.isControlDown ? NavigateMode.Look : NavigateMode.Travel;
  }

  private static scratchForward = new Vector3d();
  public doNavigate(ev: ButtonEvent): boolean {
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
      vp.setupFromFrustum(frust);
      haveNavigateEvent = false;
      if (OrientationResult.NoEvent === orientationResult)
        return false;
    }

    if (haveNavigateEvent)
      return true;
    if (OrientationResult.Success === orientationResult)
      return !this.haveStaticOrientation(forward, currentTime);
    return false;
  }

  public doManipulation(ev: ButtonEvent, inDynamics: boolean): boolean {
    if (!inDynamics)
      return true;

    this.lastPtView.setFrom(ev.viewPoint);
    return this.doNavigate(ev);
  }

  public noMotion(ev: ButtonEvent): boolean {
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

  public firstPoint(ev: ButtonEvent): boolean {
    // NB: In desktop apps we want to center the cursor in the view.
    // The browser doesn't support that, and it's more useful to be able to place the anchor point freely anyway.
    this.lastPtView.setFrom(ev.viewPoint);
    this.anchorPtView.setFrom(this.lastPtView);

    // this.decoration = new WalkDecoration(this.viewport.canvas.parentElement, this.anchorPtView, this.viewport.getContrastToBackgroundColor());
    return true;
  }

  public getHandleCursor(): Cursor { return Cursor.CrossHair; }
  public focusOut() {
    // this.decoration = this.decoration && this.decoration.destroy();
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
        input.scale(this.getMaxLinearVelocity());
        motion.pan(input.x, input.y);
        break;
      case NavigateMode.Look:
        input.scale(-this.getMaxAngularVelocity());
        motion.look(input.x, input.y);
        break;
      case NavigateMode.Travel:
        motion.travel(-input.x * this.getMaxAngularVelocity(), 0, -input.y * this.getMaxLinearVelocity(), true);
        break;
    }

    return motion;
  }
}

/** tool that performs a fit view */
export class FitViewTool extends ViewTool {
  constructor(public viewport: Viewport, public oneShot: boolean) { super(); }
  public get toolId() { return "View.Fit"; }
  public onDataButtonDown(_ev: ButtonEvent): boolean { return this.doFit(); }
  public onPostInstall() { super.onPostInstall(); this.doFit(); }
  public doFit(): boolean {
    ViewManip.fitView(this.viewport, true);
    if (this.oneShot)
      this.exitTool();
    return this.oneShot;
  }
}
