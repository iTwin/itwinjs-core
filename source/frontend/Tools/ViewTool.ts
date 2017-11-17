/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ToolAdmin } from "./ToolAdmin";
import { Tool, ButtonEvent, Cursor, WheelMouseEvent, CoordSource } from "./Tool";
import { Viewport, CoordSystem } from "../Viewport";
import { Point3d, Vector3d } from "@bentley/geometry-core/lib/PointVector";
import { Frustum, NpcCenter, Npc, MarginPercent } from "../../common/ViewState";

const toolAdmin = ToolAdmin.instance;
const scratchButtonEvent = new ButtonEvent();
const scratchFrustum = new Frustum();
const scratchPoint3d = new Point3d();

const enum ViewHandleType {
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
const enum HitPriority {
  Low = 1,
  Normal = 10,
  Medium = 100,
  High = 1000,
}

// tslint:disable:no-empty
export abstract class ViewTool extends Tool {
  public installToolImplementation() {
    if (!toolAdmin.onInstallTool(this))
      return false;

    toolAdmin.setViewTool(undefined);
    toolAdmin.startViewTool();
    toolAdmin.setViewTool(this);
    toolAdmin.onPostInstallTool(this);
    return true;
  }

  public onResetButtonUp(_ev: ButtonEvent) { this.exitTool(); return true; }

  /** Do not override. */
  public exitTool() { toolAdmin.exitViewTool(); }

}

abstract class ViewingToolHandle {
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

class ViewHandleArray {
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
  public get hitHandle() { return this.get(this.hitHandleIndex); }
  public get focusHandle() { return this.get(this.focus); }
  public add(handle: ViewingToolHandle) { this.handles.push(handle); }
  public get(index: number): ViewingToolHandle | undefined { return (index >= 0 && index < this.count) ? this.handles[index] : undefined; }
  public focusHitHandle() { this.setFocus(this.hitHandleIndex); }

  public testHit(ptScreen: Point3d, forced: number = ViewHandleType.None): boolean {
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

  public setFocus(index: number) {
    if (this.focus === index && (this.focusDrag === this.viewTool.isDragging))
      return;

    let focusHandle: ViewingToolHandle | undefined;
    if (this.focus >= 0) {
      focusHandle = this.get(this.focus);
      if (focusHandle)
        focusHandle.focusOut();
    }

    if (index >= 0) {
      focusHandle = this.get(index);
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
      const handle = this.get(i);
      if (handle && handle.handleType === handleType)
        return true;
    }

    return false;
  }

  public getHandleByType(handleType: ViewHandleType): ViewingToolHandle | undefined {
    for (let i = 0; i < this.count; i++) {
      const handle = this.get(i);
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
  private viewHandles: ViewHandleArray;
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
  private forcedHandle: ViewHandleType;
  public lastFrustum: Frustum;


  constructor(public viewport: Viewport, public handleMask: number, public isOneShot: boolean, public scrollOnNoMotion: boolean,
    public isDragOperationRequired: boolean = false, toolId: string = ToolId.ViewManip) {
    super(toolId);

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

    if (handleMask & ViewHandleType.ViewPan)
      this.viewHandles.add(new ViewPan(this));

    if (handleMask & ViewHandleType.Rotate) {
      this.synchViewBallInfo(true);
      this.viewHandles.add(new ViewRotate(this));
    }

    if (handleMask & ViewHandleType.ViewWalk)
      this.viewHandles.add(new ViewWalk(this));

    this.onReinitialize();
  }

  // const scratch =
  //   {
  //     viewPtToSpherePt:
  //       {
  //         targetCenterView: new Point3d(),
  //         ballMouse: new Point3d(),
  //       },
  //     ballPointsToMatrix: { normal: new Point3d() },
  //     screenRangeAndFrustum:
  //       {
  //         screenRange: new Point3d(),
  //         frustum: new Frustum(),
  //         testPtView: new Point3d(),
  //       },
  //     updateTargetCenter: { center: new Point3d() },
  //     zup:
  //       {
  //         viewX: new Point3d(),
  //         viewY: new Point3d(),
  //         viewZ: new Point3d(),
  //         rotMatrix: new Matrix3(),
  //         transform: new Matrix4(),
  //         frust: new Frustum(),
  //         worldUp: new Point3d()
  //       },
  //     fitView: { before: new Frustum(), },
  //     setTargetCenterWorld: { viewPt: new Point3d(), },
  //     setCameraLensAngle:
  //       {
  //         xVec: new Point3d(),
  //         yVec: new Point3d(),
  //         zVec: new Point3d(),
  //         targetNpc: new Point3d(),
  //         corners: [new Point3d(), new Point3d(), new Point3d()],
  //         eye: new Point3d(),
  //       },
  //   }

  public onReinitialize() {
    toolAdmin.gesturePending = false;
    this.viewport.synchWithView(true);
    this.nPts = 0;
    this.isDragging = false;
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

  public onDataButtonUp(_ev: ButtonEvent) {
    if (this.nPts <= 1 && this.isDragOperationRequired && !this.isDragOperation && this.isOneShot)
      this.exitTool();

    return false;
  }

  public onMiddleButtonDown(_ev: ButtonEvent) {
    return false; // Just let the idle tool handle this...
  }

  public onMiddleButtonUp(_ev: ButtonEvent) {
    if (this.nPts <= 1 && !this.isDragOperation && this.isOneShot)
      this.exitTool();

    return false;
  }

  public onMouseWheel(inputEv: WheelMouseEvent) {
    const ev = inputEv.clone();

    // If the viewball is active, the mouse wheel should work as if the cursor is at the target center
    if ((this.handleMask & ViewHandleType.Rotate))
      ev.setPoint(this.targetCenterWorld);

    toolAdmin.processMouseWheelEvent(ev, false);
    this.doUpdate(true);
    return true;
  }

  public onModelStartDrag(ev: ButtonEvent) {
    this.isDragOperation = true;
    toolAdmin.gesturePending = false;
    if (0 === this.nPts)
      this.onDataButtonDown(ev);

    return true;
  }

  public onModelEndDrag(ev: ButtonEvent) {
    this.isDragOperation = false;
    return 0 === this.nPts || this.onDataButtonDown(ev);
  }

  public onModelMotion(ev: ButtonEvent) {
    if (0 === this.nPts && this.viewHandles.testHit(ev.viewPoint))
      this.viewHandles.focusHitHandle();

    if (0 !== this.nPts)
      this.processPoint(ev, true);

    this.viewHandles.motion(ev);
  }

  public onModelMotionStopped(ev: ButtonEvent) {
    if (0 === this.nPts) {
      if (this.viewHandles.testHit(ev.viewPoint))
        this.viewHandles.focusHitHandle();
    }
  }

  public onModelNoMotion(ev: ButtonEvent) {
    if (0 === this.nPts)
      return;

    const hitHandle = this.viewHandles.hitHandle;
    if (hitHandle && hitHandle.noMotion(ev))
      this.doUpdate(false);
  }

  public onCleanup() {
    this.viewport.synchWithView(true);

    // ###TODO: possibly restore previous

    this.viewHandles.setFocus(-1);
    this.viewHandles.empty();
  }

  public isSameFrustum() {
    const frust = this.viewport.getWorldFrustum(scratchFrustum);
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
    if (center && this.isPointVisible(viewport, center)) {
      this.setTargetCenterWorld(center, true);
      return;
    }

    center = new Point3d();

    if (this.viewport.viewCmdTargetCenter && this.isPointVisible(this.viewCmdTargetCenter)) {
      this.setTargetCenterWorld(this.viewCmdTargetCenter, true);
      return;
    }

    if (!this.viewport.view.allow3dManipulations()) {
      this.viewport.npcToWorld(NpcCenter, center);
      center.z = 0.0;
    } else {
      this.viewport.determineDefaultRotatePoint(center);
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

  public lensAngleMatches(angle: number, tolerance: number) {
    const cameraView = this.viewport.view;
    return !cameraView.is3d() ? false : Math.abs(cameraView.calcLensAngle().radians - angle) < tolerance;
  }

  public isZUp() {
    const view = this.viewport.view;
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

    if (!this.viewport.view.allow3dManipulations())
      this.targetCenterWorld.z = 0.0;

    this.viewport.viewCmdTargetCenter = (snapOrPrecision ? pt : undefined);

    const viewPt = this.viewport.worldToView(this.targetCenterWorld, scratchPoint3d);
    const ev = scratchButtonEvent;
    ev.initEvent(this.targetCenterWorld, this.targetCenterWorld, viewPt, this.viewport, CoordSource.User, 0);
    toolAdmin.setAdjustedDataPoint(ev);
    ev.reset();
  }

  public invalidateTargetCenter() { this.targetCenterValid = false; }

  public isPointVisible(testPt: Point3d) {
    const vp = this.viewport;
    const testPtView = vp.worldToView(testPt);
    const frustum = vp.getFrustum(CoordSystem.Screen, false, scratchFrustum);

    const screenRange = scratchPoint3d;
    screenRange.x = frustum.points[Npc._000].distance(frustum.points[Npc._100]);
    screenRange.y = frustum.points[Npc._000].distance(frustum.points[Npc._010]);
    screenRange.z = frustum.points[Npc._000].distance(frustum.points[Npc._001]);

    return (!((testPtView.x < 0 || testPtView.x > screenRange.x) || (testPtView.y < 0 || testPtView.y > screenRange.y)));
  }

  public static fitView(viewport: Viewport, doUpdate: boolean, marginPercent: MarginPercent) {
    const range = viewport.computeViewRange();
    const aspect = viewport.viewRect.aspect;
    const before = viewport.getWorldFrustum(scratchFrustum);

    viewport.view.lookAtViewAlignedVolume(range, aspect, ViewToolSettings.fitExpandsClipping);
    viewport.synchWithView(false);
    viewport.moveViewToSurfaceIfRequired();
    // ###TODO: static method...this.setViewCmdTargetCenter(undefined);

    if (doUpdate)
      viewport.animateFrustumChange(before, viewport.getFrustum(), );

    viewport.synchWithView(true);
  }

  public setCameraLensAngle(lensAngle, retainEyePoint) {
    const camera = dynamicCast(this.viewport.view, CameraView);
    if (!Cesium.defined(camera))
      return false;

    const result;
    if (retainEyePoint && this.viewport.isCameraOn)
      result = camera.lookAtUsingLensAngle(camera.eyePoint, camera.targetPoint, camera.yVector, lensAngle);
    else
      result = this.viewport.turnCameraOn(lensAngle);

    if (result) {
      this.targetCenterValid = false;
      this.viewport.synchWithView(false);
    }

    return result;
  }

  public enforceZUp(pivotPoint) {
    if (this.isZUp())
      return false;

    const view = this.viewport.view;

    const viewY = view.rotation.getRow(1, scratch.zup.viewY);
    const viewZ = view.rotation.getRow(2, scratch.zup.viewZ);

    const zVec = this.viewport.geometry.rootTransform.multiplyByPointAsVector(Cartesian3.UNIT_Z, scratch.zup.worldUp);

    const rotMatrix = scratch.zup.rotMatrix;
    if (!rotMatrix.initRotationFromVectorToVector(viewY, zVec))
      return false;

    const transform = Matrix4.fromMatrixAndFixedPoint(rotMatrix, pivotPoint, scratch.zup.transform);
    const frust = this.viewport.getWorldFrustum(scratch.zup.frust);
    frust.multiply(transform);
    this.viewport.setupFromFrustum(frust);
    return true;
  }

  extend(ViewTool, ViewManip);

return ViewManip;
  });