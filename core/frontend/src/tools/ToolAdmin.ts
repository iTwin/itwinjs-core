/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Point3d, Point2d, XAndY, Vector3d, Transform, RotMatrix } from "@bentley/geometry-core";
import { ViewStatus, ViewState3d } from "../ViewState";
import { Viewport } from "../Viewport";
import {
  BeModifierKey, BeButtonState, BeButton, BeGestureEvent, Tool, BeButtonEvent, CoordSource, GestureInfo,
  BeCursor, BeWheelEvent, InputSource, BeVirtualKey, InteractiveTool, InputCollector,
} from "./Tool";
import { ViewTool, ViewManip } from "./ViewTool";
import { IdleTool } from "./IdleTool";
import { BeEvent, BeEventList } from "@bentley/bentleyjs-core";
import { PrimitiveTool } from "./PrimitiveTool";
import { DecorateContext, DynamicsContext } from "../ViewContext";
import { TentativeOrAccuSnap, AccuSnapToolState } from "../AccuSnap";
import { HitDetail } from "../HitDetail";
import { LegacyMath } from "@bentley/imodeljs-common/lib/LegacyMath";
import { NpcCenter } from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";

export const enum CoordinateLockOverrides {
  None = 0,
  ACS = (1 << 1),
  Grid = (1 << 2),     // also overrides unit lock
  All = 0xffff,
}

export class ToolState {
  public coordLockOvr = CoordinateLockOverrides.None;
  public locateCircleOn = true;
  public setFrom(other: ToolState) { this.coordLockOvr = other.coordLockOvr; this.locateCircleOn = other.locateCircleOn; }
  public clone(): ToolState { const val = new ToolState(); val.setFrom(this); return val; }
}

export class SuspendedToolState {
  private readonly toolState: ToolState;
  private readonly accuSnapState: AccuSnapToolState;
  private readonly viewCursor?: BeCursor;
  private inDynamics: boolean;
  private shuttingDown = false;

  constructor() {
    const toolAdmin = IModelApp.toolAdmin;
    const viewManager = IModelApp.viewManager;
    toolAdmin.setIncompatibleViewportCursor(true); // Don't save this...

    this.toolState = toolAdmin.toolState.clone();
    this.accuSnapState = IModelApp.accuSnap.toolState.clone();
    this.viewCursor = viewManager.cursor;
    this.inDynamics = viewManager.inDynamicsMode;
    if (this.inDynamics)
      viewManager.endDynamicsMode();
  }

  public stop() {
    if (this.shuttingDown)
      return;

    const toolAdmin = IModelApp.toolAdmin;
    const viewManager = IModelApp.viewManager;
    toolAdmin.setIncompatibleViewportCursor(true); // Don't restore this...

    toolAdmin.toolState.setFrom(this.toolState);
    IModelApp.accuSnap.toolState.setFrom(this.accuSnapState);
    viewManager.setViewCursor(this.viewCursor);
    if (this.inDynamics)
      viewManager.beginDynamicsMode();
  }
}

export class CurrentInputState {
  private _rawPoint: Point3d = new Point3d();
  private _uorPoint: Point3d = new Point3d();
  private _viewPoint: Point3d = new Point3d();
  public qualifiers = BeModifierKey.None;
  public motionTime = 0;
  public viewport?: Viewport;
  public button: BeButtonState[] = [new BeButtonState(), new BeButtonState(), new BeButtonState()];
  public lastButton: BeButton = BeButton.Data;
  public inputSource: InputSource = InputSource.Unknown;
  public inputOffset: Point2d = new Point2d();
  public wantIgnoreTest: boolean = false;
  public numberTouches: number = 0;
  public touches: Point2d[] = [new Point2d(), new Point2d(), new Point2d()];
  public touchMotionTime: number = 0;
  public buttonDownTool?: Tool = undefined;
  public lastMotion = new Point2d();

  private static doubleClickTimeout = 500;   // half-second
  private static doubleClickTolerance = 4.0;

  public get rawPoint() { return this._rawPoint; }
  public set rawPoint(pt: Point3d) { this._rawPoint.setFrom(pt); }
  public get uorPoint() { return this._uorPoint; }
  public set uorPoint(pt: Point3d) { this._uorPoint.setFrom(pt); }
  public get viewPoint() { return this._viewPoint; }
  public set viewPoint(pt: Point3d) { this._viewPoint.setFrom(pt); }
  public get wasMotion() { return 0 !== this.motionTime; }
  public get wasTouchMotion() { return 0 !== this.touchMotionTime; }
  public get isShiftDown() { return 0 !== (this.qualifiers & BeModifierKey.Shift); }
  public get isControlDown() { return 0 !== (this.qualifiers & BeModifierKey.Control); }
  public get isAltDown() { return 0 !== (this.qualifiers & BeModifierKey.Alt); }
  public isDragging(button: BeButton) { return this.button[button].isDragging; }
  public onStartDrag(button: BeButton) { this.button[button].isDragging = true; }
  public setKeyQualifier(qual: BeModifierKey, down: boolean) { this.qualifiers = down ? (this.qualifiers | qual) : (this.qualifiers & (~qual)); }
  public clearKeyQualifiers() { this.qualifiers = BeModifierKey.None; }
  public clearViewport(vp: Viewport) { if (vp === this.viewport) this.viewport = undefined; }
  private disableIgnoreTouchMotionTest() { this.wantIgnoreTest = false; }

  public clearTouch() {
    this.numberTouches = 0;
    this.touchMotionTime = 0;
    this.wantIgnoreTest = false;
  }

  public onMotion(pt2d: XAndY) {
    this.motionTime = Date.now();
    this.lastMotion.x = pt2d.x;
    this.lastMotion.y = pt2d.y;
  }

  public get hasMotionStopped(): boolean {
    const result = this.hasEventInputStopped(this.motionTime, 3 * 16);
    if (result.stopped)
      this.motionTime = result.eventTimer;

    return result.stopped;
  }

  public get hasTouchMotionPaused(): boolean {
    const result = this.hasEventInputStopped(this.touchMotionTime, 3 * 16);
    if (result.stopped)
      this.touchMotionTime = result.eventTimer;

    return result.stopped;
  }

  private hasEventInputStopped(timer: number, eventTimeout: number) {
    let isStopped = false;
    if (0 !== timer && ((Date.now() - timer) >= eventTimeout)) {
      isStopped = true;
      timer = 0;
    }
    return { eventTimer: timer, stopped: isStopped };
  }

  public changeButtonToDownPoint(ev: BeButtonEvent) {
    ev.point = this.button[ev.button].downUorPt;
    ev.rawPoint = this.button[ev.button].downRawPt;

    if (ev.viewport)
      ev.viewPoint = ev.viewport.worldToView(ev.rawPoint);
  }

  public updateDownPoint(ev: BeButtonEvent) {
    this.button[ev.button].downUorPt = ev.point;
  }

  public onButtonDown(button: BeButton) {
    const viewPt = this.viewport!.worldToView(this.button[button].downRawPt);
    const center = this.viewport!.npcToView(NpcCenter);
    viewPt.z = center.z;

    const now = Date.now();
    const isDoubleClick = ((now - this.button[button].downTime) < CurrentInputState.doubleClickTimeout)
      && (viewPt.distance(this.viewPoint) < CurrentInputState.doubleClickTolerance);

    this.button[button].init(this.uorPoint, this.rawPoint, now, true, isDoubleClick, false, this.inputSource);
    this.lastButton = button;
  }
  public onButtonUp(button: BeButton) {
    this.button[button].isDown = false;
    this.button[button].isDragging = false;
    this.lastButton = button;
  }

  public toEvent(ev: BeButtonEvent, useSnap: boolean) {
    let from = CoordSource.User;
    let uorPt = this.uorPoint.clone();
    let vp = this.viewport;

    if (useSnap) {
      const snap = TentativeOrAccuSnap.getCurrentSnap(false);
      if (snap) {
        from = snap.isHot() ? CoordSource.ElemSnap : CoordSource.User;
        uorPt = snap.adjustedPoint; // NOTE: Updated by AdjustSnapPoint even when not hot...
        vp = snap.viewport;
      } else if (IModelApp.tentativePoint.isActive) {
        from = CoordSource.TentativePoint;
        uorPt = IModelApp.tentativePoint.point;
        vp = IModelApp.tentativePoint.viewport;
      }
    }

    const buttonState = this.button[this.lastButton];
    ev.initEvent(uorPt, this.rawPoint, this.viewPoint, vp!, from, this.qualifiers, this.lastButton, buttonState.isDown, buttonState.isDoubleClick, this.inputSource);
  }

  public adjustLastDataPoint(ev: BeButtonEvent) {
    const state = this.button[BeButton.Data];
    state.downUorPt = ev.point;
    state.downRawPt = ev.point;
    this.viewport = ev.viewport;
  }

  public toEventFromLastDataPoint(ev: BeButtonEvent) {
    const state = this.button[BeButton.Data];
    const uorPt = state.downUorPt;
    const rawPt = state.downRawPt;
    const viewPt = this.viewport!.worldToView(rawPt);

    ev.initEvent(uorPt, rawPt, viewPt, this.viewport!, CoordSource.User, this.qualifiers, BeButton.Data, state.isDown, state.isDoubleClick, state.inputSource);
  }

  public fromPoint(vp: Viewport, pt: XAndY, source: InputSource) {
    this.viewport = vp;
    this._viewPoint.x = pt.x + this.inputOffset.x;
    this._viewPoint.y = pt.y + this.inputOffset.y;
    this._viewPoint.z = vp.npcToView(NpcCenter).z;
    vp.viewToWorld(this._viewPoint, this._rawPoint);
    this._uorPoint = this._rawPoint.clone();
    this.inputSource = source;
  }

  public fromButton(vp: Viewport, pt: XAndY, source: InputSource, applyLocks: boolean) {
    this.fromPoint(vp, pt, source);

    // NOTE: Using the hit point on the element is preferable to ignoring a snap that is not "hot" completely...
    if (TentativeOrAccuSnap.getCurrentSnap(false)) {
      if (applyLocks)
        IModelApp.toolAdmin.adjustSnapPoint();

      return;
    }

    IModelApp.toolAdmin.adjustPoint(this._uorPoint, vp, true, applyLocks);
  }

  public fromGesture(vp: Viewport, gestureInfo: GestureInfo, applyLocks: boolean) {
    this.disableIgnoreTouchMotionTest();
    this.fromButton(vp, gestureInfo.ptsLocation, InputSource.Touch, applyLocks);
  }

  private isAnyDragging() {
    for (const button of this.button)
      if (button.isDragging)
        return true;

    return false;
  }

  public isStartDrag(button: BeButton): boolean {
    // First make sure we aren't already dragging any button...
    if (this.isAnyDragging())
      return false;

    const state = this.button[button];
    if (!state.isDown)
      return false;

    if ((Date.now() - state.downTime) <= (7 * 16))
      return false;

    const viewPt = this.viewport!.worldToView(state.downRawPt);
    const deltaX = Math.abs(this._viewPoint.x - viewPt.x);
    const deltaY = Math.abs(this._viewPoint.y - viewPt.y);

    return ((deltaX + deltaY) > 15);
  }

  public ignoreTouchMotion(numberTouches: number, touches: XAndY[]) {
    if (!this.wantIgnoreTest)
      return false;

    numberTouches = Math.min(numberTouches, this.touches.length);
    if (numberTouches !== this.numberTouches)
      return false;

    // Treat anything less than 0.05 inches as noise
    // Note our definition of "inches" may or may not correspond to physical inches as the browser refuses to tell us the PPI of the device...
    const pixelLimit = this.viewport!.pixelsFromInches(0.05);
    for (let i = 0; i < numberTouches; i++) {
      const deltaX = Math.abs(touches[i].x - this.touches[i].x);
      const deltaY = Math.abs(touches[i].y - this.touches[i].y);
      if (deltaX > pixelLimit || deltaY > pixelLimit)
        return false;
    }
    return true;
  }

  public onTouchMotionChange(numberTouches: number, touches: XAndY[]) {
    if (0 === numberTouches) {
      this.clearTouch();
      return;
    }

    this.wantIgnoreTest = true;
    this.touchMotionTime = Date.now();
    this.numberTouches = numberTouches;
    for (let i = 0; i < this.touches.length; i++) {
      this.touches[i].x = touches[i].x;
      this.touches[i].y = touches[i].y;
    }
  }
}

// tslint:disable-next-line:variable-name
export const WheelSettings = {
  zoomRatio: 1.75,
  navigateDistPct: 3.0,
  navigateMouseDistPct: 10.0,
};

/** Default processor to handle wheel events. */
class WheelEventProcessor {
  public static process(ev: BeWheelEvent, doUpdate: boolean) {
    const vp = ev.viewport;
    if (!vp)
      return;

    this.doZoom(ev);

    if (doUpdate) {
      vp.synchWithView(true);

      // AccuSnap hit won't be invalidated without cursor motion (closes info window, etc.).
      IModelApp.accuSnap.clear();
    }
  }

  private static doZoom(ev: BeWheelEvent): ViewStatus {
    const vp = ev.viewport;
    if (!vp)
      return ViewStatus.InvalidViewport;

    let zoomRatio = WheelSettings.zoomRatio;
    if (zoomRatio < 1)
      zoomRatio = 1;
    if (ev.wheelDelta > 0)
      zoomRatio = 1 / zoomRatio;

    const target = Point3d.create();
    const isSnap = ev.getTargetPoint(target);
    let targetRoot = target.clone();
    let status: ViewStatus;

    if (vp.view.is3d() && vp.isCameraOn()) {
      let lastEventWasValid: boolean = false;
      if (!isSnap) {
        vp.worldToNpc(targetRoot, targetRoot);

        let defaultTarget: Point3d;

        const lastEvent = IModelApp.toolAdmin.lastWheelEvent;
        const path = ViewManip.getTargetHitDetail(vp, target);
        if (lastEvent && lastEvent.viewport && lastEvent.viewport.view.equals(vp.view) && lastEvent.viewPoint.distanceSquaredXY(ev.viewPoint) < .00001) {
          defaultTarget = vp.worldToNpc(lastEvent.point);
          targetRoot.z = defaultTarget.z;
          lastEventWasValid = true;
        } else if (path !== undefined) {
          defaultTarget = path.hitPoint.clone();
          targetRoot = vp.worldToNpc(defaultTarget);
        } else {
          defaultTarget = vp.determineDefaultRotatePoint();
          vp.worldToNpc(defaultTarget, defaultTarget);
          targetRoot.z = defaultTarget.z;
        }

        vp.npcToWorld(targetRoot, targetRoot);
      }

      const cameraView = vp.view as ViewState3d;
      const transform = Transform.createFixedPointAndMatrix(targetRoot, RotMatrix.createScale(zoomRatio, zoomRatio, zoomRatio));
      const oldCameraPos = cameraView.getEyePoint();
      const newCameraPos = transform.multiplyPoint3d(oldCameraPos);
      const offset = Vector3d.createStartEnd(oldCameraPos, newCameraPos);

      if (!isSnap && offset.magnitude() < .01) {
        offset.scaleToLength(1 / 3);
        lastEventWasValid = false;
        targetRoot.addInPlace(offset);
      }

      const viewTarget = cameraView.getTargetPoint().clone();
      viewTarget.addInPlace(offset);
      newCameraPos.setFrom(oldCameraPos.plus(offset));

      if (!lastEventWasValid) {
        const thisEvent = ev.clone();
        thisEvent.point.setFrom(targetRoot);
        IModelApp.toolAdmin.lastWheelEvent = thisEvent;
      }

      status = cameraView.lookAt(newCameraPos, viewTarget, cameraView.getYVector());
      vp.synchWithView(false);
    } else {
      const targetNpc = vp.worldToNpc(targetRoot);
      const trans = Transform.createFixedPointAndMatrix(targetNpc, RotMatrix.createScale(zoomRatio, zoomRatio, 1));
      const viewCenter = Point3d.create(.5, .5, .5);

      trans.multiplyPoint3d(viewCenter, viewCenter);
      vp.npcToWorld(viewCenter, viewCenter);
      status = vp.zoom(viewCenter, zoomRatio);
    }

    // if we scrolled out, we may have invalidated the current AccuSnap path
    IModelApp.accuSnap.reEvaluate();
    return status;
  }
}

/** Controls the current view, primitive, and idle tools. Forwards events to the appropriate tool. */
export class ToolAdmin {
  private readonly _toolEvents = new BeEventList();
  public currentInputState = new CurrentInputState();
  public readonly toolState = new ToolState();
  private suspendedByViewTool?: SuspendedToolState;
  public suspendedByInputCollector?: SuspendedToolState;
  public lastWheelEvent?: BeWheelEvent;
  public cursorInView = true;
  private viewTool?: ViewTool;
  private primitiveTool?: PrimitiveTool;
  private _idleTool?: IdleTool;
  private inputCollector?: InputCollector;
  public saveCursor?: BeCursor = undefined;
  public saveLocateCircle = false;
  public defaultTool = "Select";
  public gesturePending = false;
  private modifierKeyWentDown = false;
  private modifierKey = BeModifierKey.None;
  private touchBridgeMode = false; // Flag indicating that touch events are being converted into mouse events for this tool
  /** Apply operations such as transform, copy or delete to all members of an assembly. */
  public assemblyLock = false;
  /** If Grid Lock is on, project data points to grid. */
  public gridLock = false;
  /** If ACS Snap Lock is on, project snap points to the ACS plane. */
  public acsPlaneSnapLock = false;
  /** If ACS Plane Lock is on, standard view rotations are relative to the ACS instead of global. */
  public acsContextLock = false;
  private _wantEventLoop = false;

  public onInitialized() {
    this._idleTool = IModelApp.tools.create("Idle") as IdleTool;
  }
  public startEventLoop(): void {
    if (!this._wantEventLoop) {
      this._wantEventLoop = true;
      requestAnimationFrame(() => this.animationFrame());
    }
  }
  public onShutDown() {
    this._wantEventLoop = false;
    this._idleTool = undefined;
  }

  private animationFrame(): void {
    if (this._wantEventLoop) {
      this.onTimerEvent();
      IModelApp.viewManager.renderLoop();
      requestAnimationFrame(() => this.animationFrame());
    }
  }

  public get idleTool(): IdleTool { return this._idleTool!; }
  protected filterViewport(_vp: Viewport) { return false; }
  public isCurrentInputSourceMouse() { return this.currentInputState.inputSource === InputSource.Mouse; }
  public onInstallTool(tool: InteractiveTool) { this.currentInputState.clearKeyQualifiers(); return tool.onInstall(); }
  public onPostInstallTool(tool: InteractiveTool) { tool.onPostInstall(); }

  public get activeViewTool(): ViewTool | undefined { return this.viewTool; }
  public get activePrimitiveTool(): PrimitiveTool | undefined { return this.primitiveTool; }
  public get activeTool(): InteractiveTool | undefined {
    return this.viewTool ? this.viewTool : (this.inputCollector ? this.inputCollector : this.primitiveTool); // NOTE: Viewing tools suspend input collectors as well as primitives...
  }

  public getInfoString(hit: HitDetail, delimiter: string): string {
    let tool = this.activeTool;
    if (!tool)
      tool = this.idleTool;

    return tool.getInfoString(hit, delimiter);
  }

  // public onToolStateIdChanged(_tool: InteractiveTool, _toolStateId?: string): boolean { return false; }

  /**
   * Event that is raised whenever the active tool changes. This includes both primitive and viewing tools.
   * @param newTool The newly activated tool
   */
  public get activeToolChanged(): BeEvent<(newTool: Tool) => void> { return this._toolEvents.get("activeTool"); }

  public getCursorView(): Viewport | undefined { return this.currentInputState.viewport; }
  public onAccuSnapEnabled() { }
  public onAccuSnapDisabled() { }
  public onAccuSnapSyncUI() { }

  /** called when a viewport is closed */
  public onViewportClosed(vp: Viewport): void {
    //  Closing the viewport may also delete the QueryModel so we have to prevent AccuSnap from trying to use it.
    IModelApp.accuSnap.clear();
    this.currentInputState.clearViewport(vp);
  }

  public initGestureEvent(ev: BeGestureEvent, vp: Viewport, gestureInfo: GestureInfo): void {
    const current = this.currentInputState;
    current.fromGesture(vp, gestureInfo, true);
    current.toEvent(ev, false);
    if (gestureInfo.isFromMouse)
      ev.actualInputSource = InputSource.Mouse;
  }

  public onWheel(vp: Viewport, wheelDelta: number, pt2d: XAndY): void {
    if (!this.cursorInView)
      return;

    vp.removeAnimator();

    this.currentInputState.fromButton(vp, pt2d, InputSource.Mouse, true);
    const wheelEvent = new BeWheelEvent();
    wheelEvent.wheelDelta = wheelDelta;
    this.currentInputState.toEvent(wheelEvent, true);
    this.onWheelEvent(wheelEvent);
  }

  public onWheelEvent(wheelEvent: BeWheelEvent): void {
    const activeTool = this.activeTool;
    if (undefined === activeTool || !activeTool.onMouseWheel(wheelEvent))
      this.idleTool.onMouseWheel(wheelEvent);
  }

  public onMouseLeave(vp: Viewport): void {
    IModelApp.viewManager.clearInfoWindow();
    this.cursorInView = false;
    vp.invalidateDecorations();
  }

  /** @hidden */
  public updateDynamics(ev?: BeButtonEvent): void {
    if (!IModelApp.viewManager.inDynamicsMode || undefined === this.activeTool)
      return;

    if (undefined === ev) {
      ev = new BeButtonEvent();
      this.fillEventFromCursorLocation(ev);
    }

    if (undefined === ev.viewport)
      return;

    const context = new DynamicsContext(ev.viewport);
    this.activeTool.onDynamicFrame(ev, context);
  }

  /**
   * This is invoked on each frame to update current input state and forward model motion events to tools.
   */
  public onTimerEvent(): boolean {
    const tool = this.activeTool;

    const current = this.currentInputState;
    if (current.numberTouches !== 0 && !this.touchBridgeMode) {
      const touchMotionStopped = current.hasTouchMotionPaused;
      if (!touchMotionStopped)
        return true;

      if (tool)
        tool.onTouchMotionPaused();

      return true;
    }

    const ev = new BeButtonEvent();
    current.toEvent(ev, true);

    const wasMotion = current.wasMotion;
    if (!wasMotion) {
      if (tool)
        tool.onModelNoMotion(ev);

      if (InputSource.Mouse === current.inputSource) {
        IModelApp.accuSnap.onNoMotion(ev);
        // Application.accuDraw.onNoMotion(ev);
      }
    }

    if (current.hasMotionStopped) {
      if (tool)
        tool.onModelMotionStopped(ev);
      if (InputSource.Mouse === current.inputSource) {
        IModelApp.accuSnap.onMotionStopped(ev);
      }
    }

    this.updateDynamics(ev);
    return !wasMotion;  // return value unused...
  }

  public onMouseMotionEvent(ev: BeButtonEvent): boolean { return !this.filterButtonEvent(ev); }

  public async onMouseMotion(vp: Viewport, pt2d: XAndY, inputSource: InputSource): Promise<void> {
    const current = this.currentInputState;
    current.onMotion(pt2d);

    this.cursorInView = true;

    if (this.filterViewport(vp))
      return;

    const rawEvent = new BeButtonEvent();
    current.fromPoint(vp, pt2d, inputSource);
    current.toEvent(rawEvent, false);

    if (!this.onMouseMotionEvent(rawEvent)) {
      this.setIncompatibleViewportCursor(false);
      return;
    }

    await IModelApp.accuSnap.onMotion(rawEvent); // Must update AccuSnap before calling FromButton...

    const ev = new BeButtonEvent();
    current.fromButton(vp, pt2d, inputSource, true);
    current.toEvent(ev, true);

    // await IModelApp.accuDraw.onMotion(ev);

    const tool = this.activeTool;
    const isValidLocation = !tool ? true : tool.isValidLocation(ev, false);
    this.setIncompatibleViewportCursor(isValidLocation);

    if (undefined !== tool && isValidLocation) {
      if (current.isStartDrag(ev.button)) {
        current.onStartDrag(ev.button);
        current.changeButtonToDownPoint(ev);
        tool.onModelStartDrag(ev);
        return;
      }

      tool.onModelMotion(ev);
      this.updateDynamics(ev);
    }

    if (this.isLocateCircleOn)
      vp.invalidateDecorations();
  }

  public adjustPointToACS(pointActive: Point3d, vp: Viewport, perpendicular: boolean): void {
    // The "I don't want ACS lock" flag can be set by tools to override the default behavior...
    if (0 !== (this.toolState.coordLockOvr & CoordinateLockOverrides.ACS))
      return;

    let viewZRoot: Vector3d;

    // Lock to the construction plane
    if (vp.view.is3d() && vp.view.isCameraOn())
      viewZRoot = vp.view.camera.eye.vectorTo(pointActive);
    else
      viewZRoot = vp.rotMatrix.getRow(2);

    const auxOriginRoot = vp.getAuxCoordOrigin();
    const auxRMatrixRoot = vp.getAuxCoordRotation();
    let auxNormalRoot = auxRMatrixRoot.getRow(2);

    // If ACS xy plane is perpendicular to view and not snapping, project to closest xz or yz plane instead...
    if (auxNormalRoot.isPerpendicularTo(viewZRoot) && !TentativeOrAccuSnap.isHot()) {
      const auxXRoot = auxRMatrixRoot.getRow(0);
      const auxYRoot = auxRMatrixRoot.getRow(1);
      auxNormalRoot = (Math.abs(auxXRoot.dotProduct(viewZRoot)) > Math.abs(auxYRoot.dotProduct(viewZRoot))) ? auxXRoot : auxYRoot;
    }
    LegacyMath.linePlaneIntersect(pointActive, pointActive, viewZRoot, auxOriginRoot, auxNormalRoot, perpendicular);
  }

  public adjustPointToGrid(pointActive: Point3d, vp: Viewport) {
    // The "I don't want grid lock" flag can be set by tools to override the default behavior...
    if (!this.gridLock || 0 !== (this.toolState.coordLockOvr & CoordinateLockOverrides.Grid))
      return;
    vp.pointToGrid(pointActive);
  }

  public adjustPoint(pointActive: Point3d, vp: Viewport, projectToACS: boolean = true, applyLocks: boolean = true): void {
    if (Math.abs(pointActive.z) < 1.0e-7)
      pointActive.z = 0.0; // remove Z fuzz introduced by active depth when near 0...

    let handled = false;

    if (applyLocks && !(IModelApp.tentativePoint.isActive || IModelApp.accuSnap.isHot()))
      handled = IModelApp.accuDraw.adjustPoint(pointActive, vp, false);

    // NOTE: We don't need to support axis lock, it is worthless if you have AccuDraw...
    if (!handled && vp.isPointAdjustmentRequired()) {
      if (applyLocks)
        this.adjustPointToGrid(pointActive, vp);

      if (projectToACS)
        this.adjustPointToACS(pointActive, vp, false);
    } else if (applyLocks) {
      const savePoint = pointActive.clone();

      this.adjustPointToGrid(pointActive, vp);

      // if grid lock changes point, resend point to accudraw
      if (handled && !pointActive.isExactEqual(savePoint))
        IModelApp.accuDraw.adjustPoint(pointActive, vp, false);
    }

    if (Math.abs(pointActive.z) < 1.0e-7)
      pointActive.z = 0.0;
  }

  public adjustSnapPoint(perpendicular: boolean = true): void {
    const snap = TentativeOrAccuSnap.getCurrentSnap(false);
    if (!snap)
      return;

    const vp = snap.viewport;
    const isHot = snap.isHot();
    const savePt = snap.snapPoint.clone();
    const point = (isHot ? savePt : snap.getPoint());

    if (!isHot) // Want point adjusted to grid for a hit that isn't hot...
      this.adjustPointToGrid(point, vp);

    if (!IModelApp.accuDraw.adjustPoint(point, vp, isHot)) {
      if (vp.isSnapAdjustmentRequired())
        this.adjustPointToACS(point, vp, perpendicular || IModelApp.accuDraw.isActive());
    }

    if (!point.isExactEqual(savePt))
      snap.adjustedPoint.setFrom(point);
  }

  public sendDataPoint(ev: BeButtonEvent): void {
    const tool = this.activeTool;
    const current = this.currentInputState;
    if (!ev.isDown) {
      if (tool !== current.buttonDownTool)
        return; // Don't send tool UP event if it didn't get the DOWN event...

      if (tool)
        tool.onDataButtonUp(ev);

      return;
    }

    current.buttonDownTool = tool;
    IModelApp.accuDraw.onPreDataButton(ev);

    if (tool)
      tool.onDataButtonDown(ev);

    IModelApp.tentativePoint.onButtonEvent();
    IModelApp.accuDraw.onPostDataButton(ev);

    if (tool instanceof PrimitiveTool)
      tool.autoLockTarget(); // lock tool to target model of this view...

    // Don't use input event, need to account for point location adjusted to hit point on element by tools...
    const scratchEv = new BeButtonEvent();
    current.toEventFromLastDataPoint(scratchEv);
    this.updateDynamics(scratchEv);
  }

  /** return true to filter (ignore) the given button event */
  private filterButtonEvent(ev: BeButtonEvent): boolean {
    const vp = ev.viewport;
    if (undefined === vp)
      return false;

    const tool = this.activeTool;
    return tool ? !tool.isCompatibleViewport(vp, false) : false;
  }

  private onButtonEvent(ev: BeButtonEvent): boolean {
    if (this.filterButtonEvent(ev))
      return false;

    if (BeButton.Data !== ev.button)
      return true;

    const tool = this.activeTool;
    return (!tool ? true : tool.isValidLocation(ev, true));
  }

  public onDataButtonDown(vp: Viewport, pt2d: XAndY, inputSource: InputSource): void {
    vp.removeAnimator();
    if (this.filterViewport(vp))
      return;

    const ev = new BeButtonEvent();
    const current = this.currentInputState;
    current.fromButton(vp, pt2d, inputSource, true);
    current.onButtonDown(BeButton.Data);
    current.toEvent(ev, false);
    current.updateDownPoint(ev);
    this.sendDataPoint(ev);
  }

  public onDataButtonUp(vp: Viewport, pt2d: XAndY, inputSource: InputSource): void {
    if (this.filterViewport(vp))
      return;

    const current = this.currentInputState;
    const wasDragging = current.isDragging(BeButton.Data);

    const ev = new BeButtonEvent();
    current.fromButton(vp, pt2d, inputSource, true);
    current.onButtonUp(BeButton.Data);
    current.toEvent(ev, true);

    if (!this.onButtonEvent(ev))
      return;

    const tool = this.activeTool;
    if (tool !== current.buttonDownTool)
      return; // tool didn't receive the DOWN event...

    if (wasDragging) {
      if (tool)
        tool.onModelEndDrag(ev);

      return;
    }

    current.changeButtonToDownPoint(ev);
    this.sendDataPoint(ev);
  }

  public onMiddleButtonDown(vp: Viewport, pt2d: XAndY): void {
    if (this.filterViewport(vp))
      return;

    vp.removeAnimator();
    const ev = new BeButtonEvent();
    const current = this.currentInputState;
    current.fromButton(vp, pt2d, InputSource.Mouse, true);
    current.onButtonDown(BeButton.Middle);
    current.toEvent(ev, true);
    current.updateDownPoint(ev);

    if (!this.onButtonEvent(ev))
      return;

    const tool = this.activeTool;
    current.buttonDownTool = tool;

    if (!tool || !tool.onMiddleButtonDown(ev)) {
      if (this.idleTool.onMiddleButtonDown(ev)) {
        // The active tool might have changed since the idle tool installs viewing tools.
        const activeTool = this.activeTool;
        if (activeTool !== tool)
          current.buttonDownTool = activeTool;
      }
    }
  }

  public onMiddleButtonUp(vp: Viewport, pt2d: XAndY): void {
    if (this.filterViewport(vp))
      return;

    const current = this.currentInputState;
    const wasDragging = current.isDragging(BeButton.Middle);

    const ev = new BeButtonEvent();
    current.fromButton(vp, pt2d, InputSource.Mouse, true);
    current.onButtonUp(BeButton.Middle);
    current.toEvent(ev, true);

    if (!this.onButtonEvent(ev))
      return;

    const tool = this.activeTool;
    if (tool !== current.buttonDownTool)
      return;

    if (wasDragging) {
      if (tool)
        tool.onModelEndDrag(ev);

      return;
    }
    current.changeButtonToDownPoint(ev);
    if (!tool || !tool.onMiddleButtonUp(ev)) {
      this.idleTool.onMiddleButtonUp(ev);
    }
  }

  public onResetButtonDown(vp: Viewport, pt2d: XAndY): void {
    if (this.filterViewport(vp))
      return;

    vp.removeAnimator();
    const ev = new BeButtonEvent();
    const current = this.currentInputState;
    current.fromButton(vp, pt2d, InputSource.Mouse, true);
    current.onButtonDown(BeButton.Reset);
    current.toEvent(ev, true);
    current.updateDownPoint(ev);

    if (!this.onButtonEvent(ev))
      return;

    const tool = this.activeTool;
    current.buttonDownTool = tool;
    if (tool)
      tool.onResetButtonDown(ev);
  }

  public onResetButtonUp(vp: Viewport, pt2d: XAndY): void {
    if (this.filterViewport(vp))
      return;

    const current = this.currentInputState;
    const wasDragging = current.isDragging(BeButton.Reset);

    const ev = new BeButtonEvent();
    current.fromButton(vp, pt2d, InputSource.Mouse, true);
    current.onButtonUp(BeButton.Reset);
    current.toEvent(ev, true);

    if (!this.onButtonEvent(ev))
      return;

    const tool = this.activeTool;
    if (tool !== current.buttonDownTool)
      return;

    if (wasDragging) {
      if (tool)
        tool.onModelEndDrag(ev);

      return;
    }

    current.changeButtonToDownPoint(ev);
    if (tool)
      tool.onResetButtonUp(ev);
    IModelApp.tentativePoint.onButtonEvent();
  }

  private onGestureEvent(ev: BeGestureEvent): boolean { return (!this.filterButtonEvent(ev)); }
  public onEndGesture(vp: Viewport, gestureInfo: GestureInfo): void {
    vp.removeAnimator();
    this.gesturePending = false;

    const ev = new BeButtonEvent();
    this.initGestureEvent(ev, vp, gestureInfo);

    if (this.onGestureEvent(ev)) {
      const activeTool = this.activeTool;
      if (!activeTool || !activeTool.onEndGesture(ev))
        this.idleTool.onEndGesture(ev);

      this.currentInputState.clearTouch();
    }
    IModelApp.accuSnap.clear();
  }

  public onSingleFingerMove(vp: Viewport, gestureInfo: GestureInfo) {
    this.gesturePending = false;

    const current = this.currentInputState;
    if (current.ignoreTouchMotion(gestureInfo.numberTouches, gestureInfo.touches))
      return;

    vp.removeAnimator();
    const ev = new BeGestureEvent();
    this.initGestureEvent(ev, vp, gestureInfo);
    if (this.onGestureEvent(ev)) {
      const activeTool = this.activeTool;
      if (!activeTool || !activeTool.onSingleFingerMove(ev))
        this.idleTool.onSingleFingerMove(ev);

      current.onTouchMotionChange(gestureInfo.numberTouches, gestureInfo.touches);
    }
  }

  public onMultiFingerMove(vp: Viewport, gestureInfo: GestureInfo) {
    this.gesturePending = false;

    const current = this.currentInputState;
    if (current.ignoreTouchMotion(gestureInfo.numberTouches, gestureInfo.touches))
      return;

    vp.removeAnimator();
    const ev = new BeGestureEvent();
    this.initGestureEvent(ev, vp, gestureInfo);

    if (this.onGestureEvent(ev)) {
      const activeTool = this.activeTool;
      if (!activeTool || !activeTool.onMultiFingerMove(ev))
        this.idleTool.onMultiFingerMove(ev);

      current.onTouchMotionChange(gestureInfo.numberTouches, gestureInfo.touches);
    }
  }

  private processGestureInfo(vp: Viewport, info: GestureInfo, funcName: string) {
    vp.removeAnimator();
    this.gesturePending = false;
    const ev = new BeGestureEvent();
    this.initGestureEvent(ev, vp, info);
    const activeTool = this.activeTool as any;
    const activeToolFunc = activeTool[funcName];
    if (!activeToolFunc || !activeToolFunc.call(activeTool, ev))
      (this._idleTool as any)[funcName].call(this._idleTool, ev);
  }

  public onTwoFingerTap(vp: Viewport, gestureInfo: GestureInfo) { this.processGestureInfo(vp, gestureInfo, "onTwoFingerTap"); }
  public onPressAndTap(vp: Viewport, gestureInfo: GestureInfo) { this.processGestureInfo(vp, gestureInfo, "onPressAndTap"); }
  public onSingleTap(vp: Viewport, gestureInfo: GestureInfo) { this.processGestureInfo(vp, gestureInfo, "onSingleTap"); }
  public onDoubleTap(vp: Viewport, gestureInfo: GestureInfo) { this.processGestureInfo(vp, gestureInfo, "onDoubleTap"); }
  public onLongPress(vp: Viewport, gestureInfo: GestureInfo) { this.processGestureInfo(vp, gestureInfo, "onLongPress"); }

  public onModifierKeyTransition(wentDown: boolean, key: BeModifierKey) {
    if (wentDown === this.modifierKeyWentDown && key === this.modifierKey)
      return;

    const activeTool = this.activeTool;
    const changed = activeTool ? activeTool.onModifierKeyTransition(wentDown, key) : false;

    this.modifierKey = key;
    this.modifierKeyWentDown = wentDown;

    if (!changed)
      return;

    this.updateDynamics();
  }

  private static getModifierKeyFromVirtualKey(key: BeVirtualKey): BeModifierKey {
    switch (key) {
      case BeVirtualKey.Alt: return BeModifierKey.Alt;
      case BeVirtualKey.Shift: return BeModifierKey.Shift;
      case BeVirtualKey.Control: return BeModifierKey.Control;
    }
    return BeModifierKey.None;
  }

  public onKeyTransition(wentDown: boolean, key: BeVirtualKey): boolean {
    const activeTool = this.activeTool;
    if (!activeTool)
      return false;

    if (BeVirtualKey.Shift === key || BeVirtualKey.Control === key || BeVirtualKey.Alt === key) {
      this.onModifierKeyTransition(wentDown, ToolAdmin.getModifierKeyFromVirtualKey(key));
      return true;
    }

    const current = this.currentInputState;
    return activeTool.onKeyTransition(wentDown, key, current.isShiftDown, current.isControlDown);
  }

  /** @hidden */
  public setInputCollector(newTool?: InputCollector) {
    if (undefined !== this.inputCollector) {
      this.inputCollector.onCleanup();
      this.inputCollector = undefined;
    }

    if (undefined !== this.lastWheelEvent)
      this.lastWheelEvent.invalidate();
    this.inputCollector = newTool;
  }

  /** @hidden */
  public exitInputCollector() {
    if (undefined === this.inputCollector)
      return;
    let unsuspend = false;
    if (this.suspendedByInputCollector) {
      this.suspendedByInputCollector.stop();
      this.suspendedByInputCollector = undefined;
      unsuspend = true;
    }

    IModelApp.viewManager.invalidateDecorationsAllViews();
    this.setInputCollector(undefined);
    if (unsuspend) {
      const tool = this.activeTool;
      if (tool)
        tool.onUnsuspend();
    }
  }

  public startInputCollector(_newTool: InputCollector): void {
    if (undefined !== this.inputCollector) {
      this.setInputCollector(undefined);
    } else {
      const tool = this.activeTool;
      if (tool)
        tool.onSuspend();
      this.suspendedByInputCollector = new SuspendedToolState();
    }

    IModelApp.viewManager.invalidateDecorationsAllViews();
  }

  /** @hidden */
  public setViewTool(newTool?: ViewTool) {
    if (undefined !== this.viewTool) {
      this.viewTool.onCleanup();
      this.viewTool = undefined;
    }

    if (undefined !== this.lastWheelEvent)
      this.lastWheelEvent.invalidate();
    this.viewTool = newTool;
  }

  /** @hidden */
  public exitViewTool() {
    if (undefined === this.viewTool)
      return;
    let unsuspend = false;
    if (undefined !== this.suspendedByViewTool) {
      this.suspendedByViewTool.stop(); // Restore state of suspended tool...
      this.suspendedByViewTool = undefined;
      unsuspend = true;
    }

    IModelApp.viewManager.invalidateDecorationsAllViews();
    this.setViewTool(undefined);
    if (unsuspend) {
      const tool = this.activeTool;
      if (tool)
        tool.onUnsuspend();
    }

    IModelApp.accuDraw.onViewToolExit();
    this.updateDynamics();
  }

  public startViewTool() {
    const { accuDraw, accuSnap, viewManager } = IModelApp;

    accuDraw.onViewToolInstall();

    if (undefined !== this.viewTool) {
      this.setViewTool(undefined);
    } else {
      const tool = this.activeTool;
      if (tool)
        tool.onSuspend();
      this.suspendedByViewTool = new SuspendedToolState();
    }

    viewManager.invalidateDecorationsAllViews();

    this.toolState.coordLockOvr = CoordinateLockOverrides.All;
    this.toolState.locateCircleOn = false;

    accuSnap.onStartTool();

    this.setCursor(BeCursor.CrossHair);
  }

  /** @hidden */
  public setPrimitiveTool(primitiveTool?: PrimitiveTool) {
    const newTool = primitiveTool;  // in case we're restarting the same tool

    if (undefined !== this.primitiveTool) {
      IModelApp.viewManager.endDynamicsMode();

      this.primitiveTool.onCleanup();
      this.primitiveTool = undefined;
    }

    if (undefined !== this.lastWheelEvent)
      this.lastWheelEvent.invalidate();

    this.primitiveTool = newTool;
  }

  public startPrimitiveTool(newTool: PrimitiveTool) {
    this.exitViewTool();

    if (undefined !== this.primitiveTool)
      this.setPrimitiveTool(undefined);

    // clear the primitive tool first so following call does not trigger the refreshing of the ToolSetting for the previous primitive tool
    this.exitInputCollector();

    // send message that will clear state specific UI
    this.activeToolChanged.raiseEvent(newTool);

    this.setIncompatibleViewportCursor(true); // Don't restore this...

    this.toolState.coordLockOvr = CoordinateLockOverrides.None;
    this.toolState.locateCircleOn = false;

    IModelApp.accuDraw.onPrimitiveToolInstall();
    IModelApp.accuSnap.onStartTool();

    this.setCursor(newTool.getCursor());
  }

  /**
   * Starts the default tool, if any. Generally invoked automatically when other tools exit, so
   * shouldn't be called directly.
   */
  public startDefaultTool() {
    IModelApp.tools.run(this.defaultTool);
  }

  public setCursor(cursor: BeCursor | undefined): void {
    if (undefined === this.saveCursor)
      IModelApp.viewManager.setViewCursor(cursor);
    else
      this.saveCursor = cursor;
  }

  public decorate(context: DecorateContext): void {
    const tool = this.activeTool;
    if (undefined !== tool) {
      tool.decorate(context);

      if (undefined !== this.viewTool && tool !== this.viewTool)
        this.viewTool.decorateSuspended(context); // NOTE: A DgnViewTool currently can't be suspended...

      if (undefined !== this.inputCollector && tool !== this.inputCollector)
        this.inputCollector.decorateSuspended(context);

      if (undefined !== this.primitiveTool && tool !== this.primitiveTool)
        this.primitiveTool.decorateSuspended(context);
    }

    if (!this.cursorInView)
      return;

    const viewport = context.viewport!;
    const ev = new BeButtonEvent();

    this.fillEventFromCursorLocation(ev);

    if (ev.viewport !== viewport)
      return;

    const hit = IModelApp.accuDraw.isActive ? undefined : IModelApp.accuSnap.currHit; // NOTE: Show surface normal until AccuDraw becomes active...
    viewport.drawLocateCursor(context, ev.point, viewport.pixelsFromInches(IModelApp.locateManager.getApertureInches()), this.isLocateCircleOn(), hit);
  }

  public isLocateCircleOn(): boolean {
    return this.toolState.locateCircleOn && this.currentInputState.inputSource === InputSource.Mouse;
  }

  public beginDynamics(): void {
    IModelApp.accuDraw.onBeginDynamics();
    IModelApp.viewManager.beginDynamicsMode();
    this.setLocateCursor(false);
  }

  public endDynamics(): void {
    IModelApp.accuDraw.onEndDynamics();
    IModelApp.viewManager.endDynamicsMode();
    this.setLocateCursor(true);
  }

  public fillEventFromCursorLocation(ev: BeButtonEvent) { this.currentInputState.toEvent(ev, true); }
  public fillEventFromDataButton(ev: BeButtonEvent) { this.currentInputState.toEventFromLastDataPoint(ev); }
  public fillEventFromLastDataButton(ev: BeButtonEvent) { this.currentInputState.toEventFromLastDataPoint(ev); }
  public setAdjustedDataPoint(ev: BeButtonEvent) { this.currentInputState.adjustLastDataPoint(ev); }

  public convertGestureSingleTapToButtonDownAndUp(ev: BeGestureEvent) {
    this.touchBridgeMode = true;

    const displayPoint = ev.getDisplayPoint();
    const vp = ev.viewport!;
    this.onDataButtonDown(vp, displayPoint, InputSource.Touch);
    this.onDataButtonUp(vp, displayPoint, InputSource.Touch);
    this.touchBridgeMode = false;
  }

  public convertGestureToResetButtonDownAndUp(ev: BeGestureEvent) {
    this.touchBridgeMode = true;

    const displayPoint = ev.getDisplayPoint();
    const vp = ev.viewport!;
    this.onResetButtonDown(vp, displayPoint);
    this.onResetButtonUp(vp, displayPoint);
    this.touchBridgeMode = false;
  }

  public convertGestureMoveToButtonDownAndMotion(ev: BeGestureEvent) {
    this.touchBridgeMode = true;
    const vp = ev.viewport!;
    if (0 === ev.gestureInfo!.previousNumberTouches)
      this.onDataButtonDown(vp, ev.getDisplayPoint(), InputSource.Touch);
    else
      this.onMouseMotion(vp, ev.getDisplayPoint(), InputSource.Touch);
  }

  public convertGestureEndToButtonUp(ev: BeGestureEvent) {
    this.onDataButtonUp(ev.viewport!, ev.getDisplayPoint(), InputSource.Touch);
    this.touchBridgeMode = false;
  }

  public setIncompatibleViewportCursor(restore: boolean) {
    if (restore) {
      if (undefined === this.saveCursor)
        return;

      this.toolState.locateCircleOn = this.saveLocateCircle;
      IModelApp.viewManager.setViewCursor(this.saveCursor);
      this.saveCursor = undefined;
      return;
    }

    if (undefined !== this.saveCursor)
      return;

    this.saveLocateCircle = this.toolState.locateCircleOn;
    this.saveCursor = IModelApp.viewManager.cursor;
    this.toolState.locateCircleOn = false;
    IModelApp.viewManager.setViewCursor(BeCursor.NotAllowed);
  }

  /** Performs default handling of mouse wheel event (zoom in/out) */
  public processWheelEvent(ev: BeWheelEvent, doUpdate: boolean): boolean {
    WheelEventProcessor.process(ev, doUpdate);
    this.updateDynamics(ev);
    IModelApp.viewManager.invalidateDecorationsAllViews();
    return true;
  }

  public onSelectedViewportChanged(previous: Viewport | undefined, current: Viewport | undefined): void {
    IModelApp.accuDraw.onSelectedViewportChanged(previous, current);

    if (undefined === current)
      this.callOnCleanup();
    else if (undefined !== this.primitiveTool)
      this.primitiveTool.onSelectedViewportChanged(previous, current);
    else if (undefined !== this.viewTool)
      this.viewTool.onSelectedViewportChanged(previous, current);
  }

  public setLocateCircleOn(locateOn: boolean): void {
    if (undefined === this.saveCursor)
      this.toolState.locateCircleOn = locateOn;
    else
      this.saveLocateCircle = locateOn;
  }

  public setLocateCursor(enableLocate: boolean): void {
    const { viewManager } = IModelApp;
    this.setCursor(viewManager.inDynamicsMode ? BeCursor.Dynamics : BeCursor.CrossHair);
    this.setLocateCircleOn(enableLocate);
    viewManager.invalidateDecorationsAllViews();
  }

  public callOnCleanup(): void {
    this.exitViewTool();
    this.exitInputCollector();
    if (undefined !== this.primitiveTool)
      this.primitiveTool.onCleanup();
  }
}
