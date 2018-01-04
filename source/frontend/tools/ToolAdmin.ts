/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Point2d, XAndY, Vector3d } from "@bentley/geometry-core/lib/PointVector";
import { NpcCenter, ViewStatus } from "../../common/ViewState";
import { Viewport } from "../Viewport";
import { IdleTool } from "./IdleTool";
import { ViewTool, ViewToolSettings } from "./ViewTool";
import { BeDuration } from "@bentley/bentleyjs-core/lib/Time";
import { BeEvent, BeEventList } from "@bentley/bentleyjs-core/lib/BeEvent";
import {
  BeModifierKey, BeButtonState, BeButton, BeGestureEvent, Tool, BeButtonEvent, CoordSource, GestureInfo,
  BeCursor, BeWheelEvent, InputSource, BeVirtualKey,
} from "./Tool";
import { PrimitiveTool } from "./PrimitiveTool";
import { DecorateContext } from "../ViewContext";
import { AccuSnap, TentativeOrAccuSnap } from "../AccuSnap";
import { TentativePoint } from "../TentativePoint";
import { ViewManager } from "../ViewManager";
import { AccuDraw } from "../AccuDraw";
import { HitDetail } from "../HitDetail";
import { ElementLocateManager } from "../ElementLocateManager";
import { LegacyMath } from "../../common/LegacyMath";

export const enum CoordinateLockOverrides {
  OVERRIDE_COORDINATE_LOCK_None = 0,
  OVERRIDE_COORDINATE_LOCK_ACS = (1 << 1),
  OVERRIDE_COORDINATE_LOCK_Grid = (1 << 2),     // also overrides unit lock
  OVERRIDE_COORDINATE_LOCK_All = 0xffff,
}

export class ToolState {
  public coordLockOvr = CoordinateLockOverrides.OVERRIDE_COORDINATE_LOCK_None;
  public locateCircleOn = true;
}

export class CurrentInputState {
  private _rawPoint: Point3d = new Point3d();
  private _uorPoint: Point3d = new Point3d();
  private _viewPoint: Point3d = new Point3d();
  public qualifiers: BeModifierKey;
  public motionTime: number;
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
        uorPt = snap.getAdjustedPoint(); // NOTE: Updated by AdjustSnapPoint even when not hot...
        vp = snap.m_viewport;
      } else if (TentativePoint.instance.isActive) {
        from = CoordSource.TentativePoint;
        uorPt = TentativePoint.instance.point;
        vp = TentativePoint.instance.viewport;
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
    this._uorPoint = this._rawPoint;
    this.inputSource = source;
  }

  public fromButton(vp: Viewport, pt: XAndY, source: InputSource, applyLocks: boolean) {
    this.fromPoint(vp, pt, source);

    // NOTE: Using the hit point on the element is preferable to ignoring a snap that is not "hot" completely...
    if (TentativeOrAccuSnap.getCurrentSnap(false)) {
      if (applyLocks)
        ToolAdmin.instance.adjustSnapPoint();

      return;
    }

    ToolAdmin.instance.adjustPoint(this._uorPoint, vp, true, applyLocks);
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
export class ToolAdmin {
  private _toolEvents = new BeEventList();
  public static instance = new ToolAdmin();
  public currentInputState = new CurrentInputState();
  public toolState = new ToolState();
  public cursorInView = false;
  private _viewCursor?: BeCursor;
  private viewTool?: ViewTool;
  private primitiveTool?: PrimitiveTool;
  private idleTool: IdleTool;
  private inputCollector?: Tool;
  private defaultTool?: PrimitiveTool;
  public gesturePending: boolean;
  private modifierKeyWentDown: boolean;
  private modifierKey: BeModifierKey;
  private touchBridgeMode: boolean; // Flag indicating that touch events are being converted into mouse events for this tool

  /** Apply operation such as transform, copy or delete to all members of an assembly. */
  public assemblyLock = false;
  /** If Grid Lock is on, project data points to grid. */
  public gridLock = false;
  /** If ACS Snap Lock is on, project snap points to the ACS plane. */
  public acsPlaneSnapLock = false;
  /** If ACS Plane Lock is on, standard view rotations are relative to the ACS instead of global. */
  public acsContextLock = false;

  protected filterViewport(_vp: Viewport) { return false; }
  public isCurrentInputSourceMouse() { return this.currentInputState.inputSource === InputSource.Mouse; }
  public onInstallTool(tool: Tool) { this.currentInputState.clearKeyQualifiers(); return tool.onInstall(); }
  public onPostInstallTool(tool: Tool) { tool.onPostInstall(); }

  public get activeViewTool(): ViewTool | undefined { return this.viewTool; }
  public get activeTool(): Tool | undefined {
    return this.viewTool ? this.viewTool : (this.inputCollector ? this.inputCollector : this.primitiveTool); // NOTE: Viewing tools suspend input collectors as well as primitives...
  }

  public getInfoString(hit: HitDetail, delimiter: string): string {
    let tool = this.activeTool;
    if (!tool)
      tool = this.idleTool;

    return tool.getInfoString(hit, delimiter);
  }

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
    AccuSnap.instance.clear();
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
    vp.removeAnimator();
    this.currentInputState.fromButton(vp, pt2d, InputSource.Mouse, true);
    const wheelEvent = new BeWheelEvent();
    wheelEvent.wheelDelta = wheelDelta;
    this.currentInputState.toEvent(wheelEvent, true);
    this.onWheelEvent(wheelEvent);
  }

  public onWheelEvent(wheelEvent: BeWheelEvent): void {
    const activeTool = this.activeTool;
    if (!activeTool || !activeTool.onMouseWheel(wheelEvent))
      this.idleTool.onMouseWheel(wheelEvent);
  }

  private static scratchButtonEvent1 = new BeButtonEvent();
  private static scratchButtonEvent2 = new BeButtonEvent();
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

    const ev = ToolAdmin.scratchButtonEvent1;
    current.toEvent(ev, true);

    const wasMotion = current.wasMotion;
    if (!wasMotion) {
      if (tool)
        tool.onModelNoMotion(ev);

      if (InputSource.Mouse === current.inputSource) {
        AccuSnap.instance.onNoMotion(ev);
        // AccuDraw.instance.onNoMotion(ev);
      }
    }

    if (current.hasMotionStopped) {
      if (tool)
        tool.onModelMotionStopped(ev);
      if (InputSource.Mouse === current.inputSource) {
        AccuSnap.instance.onMotionStopped(ev);
      }
    }

    if (tool)
      tool.updateDynamics(ev);

    ev.reset();
    return !wasMotion;  // return value unused...
  }

  public onMouseMotion(vp: Viewport, pt2d: XAndY, inputSource: InputSource): void {
    const current = this.currentInputState;
    current.onMotion(pt2d);

    if (this.filterViewport(vp))
      return;

    const tool = this.activeTool;
    const ev = ToolAdmin.scratchButtonEvent1;
    current.fromPoint(vp, pt2d, inputSource);
    current.toEvent(ev, false);

    // AccuDraw:: GetInstance()._OnMotion(event);
    const isValidLocation = !tool ? true : tool.isValidLocation(ev, false);

    if (tool && isValidLocation) {
      if (current.isStartDrag(ev.button)) {
        current.onStartDrag(ev.button);
        current.changeButtonToDownPoint(ev);
        tool.onModelStartDrag(ev);
        ev.reset();
        return;
      }
      tool.onModelMotion(ev);
    }
    // Don't use the old value of tool since _OnModelMotion may restart the tool using a new tool object.
    const primitiveTool = this.activeTool;
    if (primitiveTool instanceof PrimitiveTool)
      primitiveTool.updateDynamics(ev);

    ev.reset();
  }

  public adjustPointToACS(pointActive: Point3d, vp: Viewport, perpendicular: boolean): void {
    // The "I don't want ACS lock" flag can be set by tools to override the default behavior...
    if (0 !== (this.toolState.coordLockOvr & CoordinateLockOverrides.OVERRIDE_COORDINATE_LOCK_ACS))
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
    if (0 !== (this.toolState.coordLockOvr & CoordinateLockOverrides.OVERRIDE_COORDINATE_LOCK_Grid))
      return;

    if (!this.gridLock)
      return;

    vp.pointToGrid(pointActive);
  }

  public adjustPoint(pointActive: Point3d, vp: Viewport, projectToACS: boolean = true, applyLocks: boolean = true): void {
    if (Math.abs(pointActive.z) < 1.0e-7)
      pointActive.z = 0.0; // remove Z fuzz introduced by active depth when near 0...

    let handled = false;

    if (applyLocks && !(TentativePoint.instance.isActive || AccuSnap.instance.isHot()))
      handled = AccuDraw.instance.adjustPoint(pointActive, vp, false);

    // NOTE: We don't need to support axis lock, it's worthless if you have AccuDraw...
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
        AccuDraw.instance.adjustPoint(pointActive, vp, false);
    }

    if (Math.abs(pointActive.z) < 1.0e-7)
      pointActive.z = 0.0;
  }

  public adjustSnapPoint(perpendicular: boolean = true): void {
    const snap = TentativeOrAccuSnap.getCurrentSnap(false);
    if (!snap)
      return;

    const vp = snap.m_viewport;
    const isHot = snap.isHot();
    const savePt = snap.m_snapPoint.clone();
    const point = (isHot ? savePt : snap.getHitPoint());

    if (!isHot) // Want point adjusted to grid for a hit that isn't hot...
      this.adjustPointToGrid(point, vp);

    if (!AccuDraw.instance.adjustPoint(point, vp, isHot)) {
      if (vp.isSnapAdjustmentRequired())
        this.adjustPointToACS(point, vp, perpendicular || AccuDraw.instance.isActive());
    }

    if (!point.isExactEqual(savePt))
      snap.m_adjustedPt.setFrom(point);
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
    AccuDraw.instance.onPreDataButton(ev);

    if (tool)
      tool.onDataButtonDown(ev);

    TentativePoint.instance.onButtonEvent();
    AccuDraw.instance.onPostDataButton(ev);
    if (!(tool instanceof PrimitiveTool))
      return;

    tool.autoLockTarget(); // lock tool to target model of this view...

    // Don't use input event, need to account for point location adjusted to hit point on element by tools...
    const scratchEv = ToolAdmin.scratchButtonEvent2;
    current.toEventFromLastDataPoint(scratchEv);
    tool.updateDynamics(scratchEv);
  }

  /** return true to filter (ignore) the given button event */
  private filterButtonEvent(ev: BeButtonEvent): boolean {
    const vp = ev.viewport;
    if (!vp)
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

    const ev = ToolAdmin.scratchButtonEvent1;
    const current = this.currentInputState;
    current.fromButton(vp, pt2d, inputSource, true);
    current.onButtonDown(BeButton.Data);
    current.toEvent(ev, false);
    current.updateDownPoint(ev);
    this.sendDataPoint(ev);
    ev.reset();
  }

  public onDataButtonUp(vp: Viewport, pt2d: XAndY, inputSource: InputSource): void {
    if (this.filterViewport(vp))
      return;

    const current = this.currentInputState;
    const wasDragging = current.isDragging(BeButton.Data);

    const ev = ToolAdmin.scratchButtonEvent1;
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

      ev.reset();
      return;
    }

    current.changeButtonToDownPoint(ev);
    this.sendDataPoint(ev);
    ev.reset();
  }

  public onMiddleButtonDown(vp: Viewport, pt2d: XAndY): void {
    if (this.filterViewport(vp))
      return;

    vp.removeAnimator();
    const ev = ToolAdmin.scratchButtonEvent1;
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

    ev.reset();
  }

  public onMiddleButtonUp(vp: Viewport, pt2d: XAndY): void {
    if (this.filterViewport(vp))
      return;

    const current = this.currentInputState;
    const wasDragging = current.isDragging(BeButton.Middle);

    const ev = ToolAdmin.scratchButtonEvent1;
    current.fromButton(vp, pt2d, InputSource.Mouse, true);
    current.onButtonUp(BeButton.Middle);
    current.toEvent(ev, true);

    if (!this.onButtonEvent(ev))
      return;

    const tool = this.activeTool;
    if (tool !== current.buttonDownTool) {
      ev.reset();
      return;
    }

    if (wasDragging) {
      if (tool)
        tool.onModelEndDrag(ev);

      ev.reset();
      return;
    }

    current.changeButtonToDownPoint(ev);
    if (!tool || !tool.onMiddleButtonUp(ev))
      this.idleTool.onMiddleButtonUp(ev);

    ev.reset();
  }

  public onResetButtonDown(vp: Viewport, pt2d: XAndY): void {
    if (this.filterViewport(vp))
      return;

    vp.removeAnimator();
    const ev = ToolAdmin.scratchButtonEvent1;
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

    ev.reset();
  }

  public onResetButtonUp(vp: Viewport, pt2d: XAndY): void {
    if (this.filterViewport(vp))
      return;

    const current = this.currentInputState;
    const wasDragging = current.isDragging(BeButton.Reset);

    const ev = ToolAdmin.scratchButtonEvent1;
    current.fromButton(vp, pt2d, InputSource.Mouse, true);
    current.onButtonUp(BeButton.Reset);
    current.toEvent(ev, true);

    if (!this.onButtonEvent(ev))
      return;

    const tool = this.activeTool;
    if (tool !== current.buttonDownTool) {
      ev.reset();
      return;
    }

    if (wasDragging) {
      if (tool)
        tool.onModelEndDrag(ev);

      ev.reset();
      return;
    }

    current.changeButtonToDownPoint(ev);
    if (tool)
      tool.onResetButtonUp(ev);
    ev.reset();
    TentativePoint.instance.onButtonEvent();
  }

  private scratchGestureEvent = new BeGestureEvent();
  private onGestureEvent(ev: BeGestureEvent): boolean { return (!this.filterButtonEvent(ev)); }
  public onEndGesture(vp: Viewport, gestureInfo: GestureInfo): void {
    vp.removeAnimator();
    this.gesturePending = false;

    const ev = ToolAdmin.scratchButtonEvent1;
    this.initGestureEvent(ev, vp, gestureInfo);

    if (this.onGestureEvent(ev)) {
      const activeTool = this.activeTool;
      if (!activeTool || !activeTool.onEndGesture(ev))
        this.idleTool.onEndGesture(ev);

      this.currentInputState.clearTouch();
    }
    ev.reset();
    AccuSnap.instance.clear();
  }

  public onSingleFingerMove(vp: Viewport, gestureInfo: GestureInfo) {
    this.gesturePending = false;

    const current = this.currentInputState;
    if (current.ignoreTouchMotion(gestureInfo.numberTouches, gestureInfo.touches))
      return;

    vp.removeAnimator();
    const ev = this.scratchGestureEvent;
    this.initGestureEvent(ev, vp, gestureInfo);
    if (this.onGestureEvent(ev)) {
      const activeTool = this.activeTool;
      if (!activeTool || !activeTool.onSingleFingerMove(ev))
        this.idleTool.onSingleFingerMove(ev);

      current.onTouchMotionChange(gestureInfo.numberTouches, gestureInfo.touches);
    }
    ev.reset();
  }

  public onMultiFingerMove(vp: Viewport, gestureInfo: GestureInfo) {
    this.gesturePending = false;

    const current = this.currentInputState;
    if (current.ignoreTouchMotion(gestureInfo.numberTouches, gestureInfo.touches))
      return;

    vp.removeAnimator();
    const ev = this.scratchGestureEvent;
    this.initGestureEvent(ev, vp, gestureInfo);

    if (this.onGestureEvent(ev)) {
      const activeTool = this.activeTool;
      if (!activeTool || !activeTool.onMultiFingerMove(ev))
        this.idleTool.onMultiFingerMove(ev);

      current.onTouchMotionChange(gestureInfo.numberTouches, gestureInfo.touches);
    }
    ev.reset();
  }

  private processGestureInfo(vp: Viewport, info: GestureInfo, funcName: string) {
    vp.removeAnimator();
    this.gesturePending = false;
    const ev = this.scratchGestureEvent;
    this.initGestureEvent(ev, vp, info);
    const activeTool = this.activeTool as any;
    const activeToolFunc = activeTool[funcName];
    if (!activeToolFunc || !activeToolFunc.call(activeTool, ev))
      (this.idleTool as any)[funcName].call(this.idleTool, ev);

    ev.reset();
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

    // Give active tool a chance to update it's dynamics...
    if (activeTool instanceof PrimitiveTool) {
      const ev = ToolAdmin.scratchButtonEvent1;
      this.fillEventFromCursorLocation(ev);
      activeTool.updateDynamics(ev);
    }
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

  public setPrimitiveTool(primitiveTool?: PrimitiveTool) {
    const prevActiveTool = this.activeTool;
    if (this.primitiveTool) {
      this.primitiveTool.onCleanup();
      ViewManager.instance.endDynamicsMode();
    }

    this.primitiveTool = primitiveTool;

    const newActiveTool = this.activeTool;
    if (newActiveTool !== prevActiveTool)
      this.activeToolChanged.raiseEvent(newActiveTool);
  }

  /** Invoked by ViewTool.installToolImplementation */
  public setViewTool(newTool?: ViewTool) {
    if (this.viewTool)
      this.viewTool.onCleanup();

    this.viewTool = newTool;

    // const primitiveTool = this.primitiveTool;
    // if (Cesium.defined(primitiveTool) && Cesium.defined(newTool)) primitiveTool.onSuspended();
    // else if (!Cesium.defined(newTool)) {
    //   this.setViewCursor(Cesium.defined(primitiveTool) && Cesium.defined(primitiveTool.getCursor) ? primitiveTool.getCursor() : Cursor.Default);
    // }
    this.activeToolChanged.raiseEvent(newTool);
  }

  /** Invoked by ViewTool.exitTool */
  public exitViewTool() {
    if (!this.viewTool)
      return;

    // this.setViewCursor(this.suspendedCursor);
    // this.suspendedCursor = undefined;
    this.setViewTool(undefined);

    AccuDraw.instance.onViewToolExit();

    const tool = this.activeTool;
    if (tool && tool.isPrimitive()) {
      const ev = ToolAdmin.scratchButtonEvent1;
      this.fillEventFromCursorLocation(ev);
      tool.updateDynamics(ev);
    }
  }

  public startViewTool() {
    if (this.viewTool)
      this.setViewTool(undefined);
    // else
    //   this.suspendedCursor = this.viewCursor;

    AccuSnap.instance.onStartTool();

    this.viewCursor = BeCursor.CrossHair;
    // we don't actually start the tool here...
  }

  public startPrimitiveTool(newTool: PrimitiveTool) {
    this.exitViewTool();
    if (this.primitiveTool)
      this.setPrimitiveTool(undefined);

    // this.exitInputCollector();
    // this.setIncompatibleViewportCursor(true); // Don't restore this...
    AccuDraw.instance.onPrimitiveToolInstall();
    AccuSnap.instance.onStartTool();

    this.viewCursor = newTool.getCursor();

    // we don't actually start the tool here...
  }

  /** establish the default tool */
  public setDefaultTool(tool: PrimitiveTool) { this.defaultTool = tool; }
  /**
   * Starts the default tool, if any. Generally invoked automatically when other tools exit, so
   * shouldn't be called directly.
   */
  public startDefaultTool() {
    if (this.defaultTool && this.activeTool !== this.defaultTool) {
      this.defaultTool.installTool();
    } else {
      this.setViewTool(undefined);
      this.setPrimitiveTool(undefined);
      this.viewCursor = BeCursor.Default;
    }
  }

  public get viewCursor() { return this._viewCursor; }
  public set viewCursor(cursor: BeCursor | undefined) {
    this._viewCursor = cursor ? cursor : BeCursor.Default;
    // const canvas = this.viewport.canvas;
    // canvas.style.cursor = cursor;
  }

  public decorate(context: DecorateContext): void {
    const tool = this.activeTool;
    if (tool) {
      tool.decorate(context);

      if (this.viewTool && tool !== this.viewTool)
        this.viewTool.decorateSuspended(context); // NOTE: A DgnViewTool currently can't be suspended...

      if (this.inputCollector && tool !== this.inputCollector)
        this.inputCollector.decorateSuspended(context);

      if (this.primitiveTool && tool !== this.primitiveTool)
        this.primitiveTool.decorateSuspended(context);
    }

    if (!this.cursorInView)
      return;

    const viewport = context.viewport;
    const ev = ToolAdmin.scratchButtonEvent1;
    this.fillEventFromCursorLocation(ev);
    if (ev.viewport !== viewport)
      return;

    const hit = AccuDraw.instance.isActive ? undefined : AccuSnap.instance.currHit; // NOTE: Show surface normal until AccuDraw becomes active...
    viewport.drawLocateCursor(context, ev.point, viewport.pixelsFromInches(ElementLocateManager.instance.getApertureInches()), this.isLocateCircleOn(), hit);
  }
  public isLocateCircleOn(): boolean {
    return this.toolState.locateCircleOn && this.currentInputState.inputSource === InputSource.Mouse;
  }

  public beginDynamics(): void {
    AccuDraw.instance.onBeginDynamics();
    ViewManager.instance.beginDynamicsMode();
    // this.setLocateCursor(false);
  }

  public endDynamics(): void {
    AccuDraw.instance.onEndDynamics();
    ViewManager.instance.endDynamicsMode();
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

  private wheelEventProcessor = new WheelEventProcessor();

  /** Performs default handling of mouse wheel event (zoom in/out) */
  public processWheelEvent(ev: BeWheelEvent, doUpdate: boolean): boolean {
    this.wheelEventProcessor.ev = ev;
    const result = this.wheelEventProcessor.process(doUpdate);
    this.wheelEventProcessor.ev = undefined;

    if (this.primitiveTool)
      this.primitiveTool.updateDynamics(ev);

    return result;
  }
}

// tslint:disable-next-line:variable-name
const WheelSettings = {
  zoomRatio: 1.75,
  navigateDistPct: 3.0,
  navigateMouseDistPct: 10.0,
};

class WheelEventProcessor {
  constructor(public ev?: BeWheelEvent) { }
  public process(doUpdate: boolean): boolean {
    const vp = this.ev!.viewport;
    if (!vp)
      return true;

    this.doZoom();

    if (doUpdate) {
      const hasPendingWheelEvent = false; //  Display:: Kernel:: HasPendingMouseWheelEvent(); NEEDS_WORK

      // don't put into undo buffer if we're about to get another wheel event.
      if (!hasPendingWheelEvent)
        vp.synchWithView(true);

      // AccuSnap hit won't be invalidated without cursor motion (closes info window, etc.).
      AccuSnap.instance.clear();
    }
    return true;
  }

  private doZoom(): ViewStatus {
    const ev = this.ev!;
    let zoomRatio = Math.max(1.0, WheelSettings.zoomRatio);

    const wheelDelta = ev.wheelDelta;
    if (wheelDelta > 0)
      zoomRatio = 1.0 / zoomRatio;

    const vp = ev.viewport!;
    const startFrust = vp.getFrustum();

    const zoomCenter = vp.getZoomCenter(ev);
    const result = vp.zoom(zoomCenter, zoomRatio);
    if (ViewStatus.Success === result) {
      if (ViewToolSettings.animateZoom)
        vp.animateFrustumChange(startFrust, vp.getFrustum(), BeDuration.fromMilliseconds(100));
    }

    return result;
  }
}
