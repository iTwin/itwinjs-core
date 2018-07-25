/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Point3d, Point2d, XAndY, Vector3d, Transform, RotMatrix } from "@bentley/geometry-core";
import { ViewStatus, ViewState3d } from "../ViewState";
import { Viewport } from "../Viewport";
import {
  BeModifierKeys, BeButtonState, BeButton, BeGestureEvent, Tool, BeButtonEvent, CoordSource, GestureInfo,
  BeCursor, BeWheelEvent, InputSource, InteractiveTool, InputCollector, EventHandled,
} from "./Tool";
import { ViewTool } from "./ViewTool";
import { IdleTool } from "./IdleTool";
import { BeEvent } from "@bentley/bentleyjs-core";
import { PrimitiveTool } from "./PrimitiveTool";
import { DecorateContext, DynamicsContext } from "../ViewContext";
import { TentativeOrAccuSnap, AccuSnap } from "../AccuSnap";
import { HitDetail } from "../HitDetail";
import { LegacyMath } from "@bentley/imodeljs-common/lib/LegacyMath";
import { NpcCenter } from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { IconSprites } from "../Sprites";

// tslint:disable:no-console

export const enum CoordinateLockOverrides {
  None = 0,
  ACS = (1 << 1),
  Grid = (1 << 2),     // also overrides unit lock
  All = 0xffff,
}

const enum MouseButton { Left = 0, Middle = 1, Right = 2 }

export class ToolState {
  public coordLockOvr = CoordinateLockOverrides.None;
  public locateCircleOn = true;
  public setFrom(other: ToolState) { this.coordLockOvr = other.coordLockOvr; this.locateCircleOn = other.locateCircleOn; }
  public clone(): ToolState { const val = new ToolState(); val.setFrom(this); return val; }
}

export class SuspendedToolState {
  private readonly toolState: ToolState;
  private readonly accuSnapState: AccuSnap.ToolState;
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
  public qualifiers = BeModifierKeys.None;
  public motionTime = 0;
  public viewport?: Viewport;
  public button: BeButtonState[] = [new BeButtonState(), new BeButtonState(), new BeButtonState()];
  public lastButton: BeButton = BeButton.Data;
  public inputSource: InputSource = InputSource.Unknown;
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
  public get isShiftDown() { return 0 !== (this.qualifiers & BeModifierKeys.Shift); }
  public get isControlDown() { return 0 !== (this.qualifiers & BeModifierKeys.Control); }
  public get isAltDown() { return 0 !== (this.qualifiers & BeModifierKeys.Alt); }
  public isDragging(button: BeButton) { return this.button[button].isDragging; }
  public onStartDrag(button: BeButton) { this.button[button].isDragging = true; }
  public setKeyQualifier(qual: BeModifierKeys, down: boolean) { this.qualifiers = down ? (this.qualifiers | qual) : (this.qualifiers & (~qual)); }
  public clearKeyQualifiers() { this.qualifiers = BeModifierKeys.None; }
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
    const uorPt = this.uorPoint.clone();
    let vp = this.viewport;

    if (useSnap) {
      const snap = TentativeOrAccuSnap.getCurrentSnap(false);
      if (snap) {
        from = snap.isHot() ? CoordSource.ElemSnap : CoordSource.User;
        uorPt.setFrom(snap.adjustedPoint); // NOTE: Updated by AdjustSnapPoint even when not hot...
        vp = snap.viewport;
      } else if (IModelApp.tentativePoint.isActive) {
        from = CoordSource.TentativePoint;
        uorPt.setFrom(IModelApp.tentativePoint.point);
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
    this._viewPoint.x = pt.x;
    this._viewPoint.y = pt.y;
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
  public static async process(ev: BeWheelEvent, doUpdate: boolean) {
    const vp = ev.viewport;
    if (!vp)
      return;

    await this.doZoom(ev);

    if (doUpdate) {
      vp.synchWithView(true);

      // AccuSnap hit won't be invalidated without cursor motion (closes info window, etc.).
      IModelApp.accuSnap.clear();
    }
  }

  private static async doZoom(ev: BeWheelEvent): Promise<ViewStatus> {
    const vp = ev.viewport;
    if (!vp)
      return ViewStatus.InvalidViewport;

    let zoomRatio = WheelSettings.zoomRatio;
    if (zoomRatio < 1)
      zoomRatio = 1;
    if (ev.wheelDelta > 0)
      zoomRatio = 1 / zoomRatio;

    let isSnapOrPrecision = false;
    const target = Point3d.create();
    if (IModelApp.tentativePoint.isActive) {
      // Always use Tentative location, adjusted point, not cross...
      isSnapOrPrecision = true;
      target.setFrom(IModelApp.tentativePoint.getPoint());
    } else {
      // Never use AccuSnap location as initial zoom clears snap causing zoom center to "jump"...
      isSnapOrPrecision = CoordSource.Precision === ev.coordsFrom;
      target.setFrom(isSnapOrPrecision ? ev.point : ev.rawPoint);
    }

    let status: ViewStatus;
    if (vp.view.is3d() && vp.isCameraOn()) {
      let lastEventWasValid: boolean = false;
      if (!isSnapOrPrecision) {
        const targetNpc = vp.worldToNpc(target);
        const newTarget = new Point3d();
        const lastEvent = IModelApp.toolAdmin.lastWheelEvent;
        if (lastEvent && lastEvent.viewport && lastEvent.viewport.view.equals(vp.view) && lastEvent.viewPoint.distanceSquaredXY(ev.viewPoint) < 10) {
          vp.worldToNpc(lastEvent.point, newTarget);
          targetNpc.z = newTarget.z;
          lastEventWasValid = true;
        } else if (undefined !== vp.pickNearestVisibleGeometry(target, 20.0, newTarget)) {
          vp.worldToNpc(newTarget, newTarget);
          targetNpc.z = newTarget.z;
        } else {
          vp.view.getTargetPoint(newTarget);
          vp.worldToNpc(newTarget, newTarget);
          targetNpc.z = newTarget.z;
        }
        vp.npcToWorld(targetNpc, target);
      }

      const cameraView = vp.view as ViewState3d;
      const transform = Transform.createFixedPointAndMatrix(target, RotMatrix.createScale(zoomRatio, zoomRatio, zoomRatio));
      const oldCameraPos = cameraView.getEyePoint();
      const newCameraPos = transform.multiplyPoint3d(oldCameraPos);
      const offset = Vector3d.createStartEnd(oldCameraPos, newCameraPos);

      if (!isSnapOrPrecision && offset.magnitude() < .01) {
        offset.scaleToLength(1 / 3, offset);
        lastEventWasValid = false;
        target.addInPlace(offset);
      }

      const viewTarget = cameraView.getTargetPoint().clone();
      viewTarget.addInPlace(offset);
      newCameraPos.setFrom(oldCameraPos.plus(offset));

      if (!lastEventWasValid) {
        const thisEvent = ev.clone();
        thisEvent.point.setFrom(target);
        IModelApp.toolAdmin.lastWheelEvent = thisEvent;
      }

      status = cameraView.lookAt(newCameraPos, viewTarget, cameraView.getYVector());
      vp.synchWithView(false);
    } else {
      const targetNpc = vp.worldToNpc(target);
      const trans = Transform.createFixedPointAndMatrix(targetNpc, RotMatrix.createScale(zoomRatio, zoomRatio, 1));
      const viewCenter = Point3d.create(.5, .5, .5);

      trans.multiplyPoint3d(viewCenter, viewCenter);
      vp.npcToWorld(viewCenter, viewCenter);
      status = vp.zoom(viewCenter, zoomRatio);
    }

    // if we scrolled out, we may have invalidated the current AccuSnap path
    await IModelApp.accuSnap.reEvaluate();
    return status;
  }
}

/** A tool event combines an HTML Event and a Viewport. */
interface ToolEvent {
  ev: Event;
  vp?: Viewport;
}

/** Controls the current view, primitive, and idle tools. Forwards events to the appropriate tool. */
export class ToolAdmin {
  public currentInputState = new CurrentInputState();
  public readonly toolState = new ToolState();
  private suspendedByViewTool?: SuspendedToolState;
  public suspendedByInputCollector?: SuspendedToolState;
  public lastWheelEvent?: BeWheelEvent;
  public cursorView?: Viewport;
  private viewTool?: ViewTool;
  private primitiveTool?: PrimitiveTool;
  private _idleTool?: IdleTool;
  private inputCollector?: InputCollector;
  public saveCursor?: BeCursor = undefined;
  public saveLocateCircle = false;
  public defaultTool = "Select";
  public gesturePending = false;
  private modifierKeyWentDown = false;
  private modifierKey = BeModifierKeys.None;
  private touchBridgeMode = false; // Flag indicating that touch events are being converted into mouse events for this tool
  /** Apply operations such as transform, copy or delete to all members of an assembly. */
  public assemblyLock = false;
  /** If Grid Lock is on, project data points to grid. */
  public gridLock = false;
  /** If ACS Snap Lock is on, project snap points to the ACS plane. */
  public acsPlaneSnapLock = false;
  /** If ACS Plane Lock is on, standard view rotations are relative to the ACS instead of global. */
  public acsContextLock = false;
  private static _wantEventLoop = false;

  private static keyEventHandler(ev: KeyboardEvent) { IModelApp.toolAdmin.addEvent(ev); }
  /** @hidden */
  public onInitialized() {
    this._idleTool = IModelApp.tools.create("Idle") as IdleTool;
    document.addEventListener("keydown", ToolAdmin.keyEventHandler, true);
    document.addEventListener("keyup", ToolAdmin.keyEventHandler, true);

  }
  /** @hidden */
  public startEventLoop(): void {
    if (!ToolAdmin._wantEventLoop) {
      ToolAdmin._wantEventLoop = true;
      requestAnimationFrame(ToolAdmin.eventLoop);
    }
  }

  /** @hidden */
  public onShutDown(): void {
    IconSprites.emptyAll(); // clear cache of icon sprites
    ToolAdmin._wantEventLoop = false;
    this._idleTool = undefined;
    document.removeEventListener("keydown", ToolAdmin.keyEventHandler, true);
    document.removeEventListener("keyup", ToolAdmin.keyEventHandler, true);
  }

  /** A first-in-first-out queue of ToolEvents. */
  private readonly toolEvents: ToolEvent[] = [];
  private tryReplace(event: ToolEvent): boolean {
    if (this.toolEvents.length < 1)
      return false;
    const last = this.toolEvents[this.toolEvents.length - 1];
    if (last.ev.type !== "mousemove" || event.ev.type !== "mousemove") // only mousemove can replace previous
      return false;
    last.ev = event.ev;
    last.vp = event.vp;
    return true;
  }

  /** Called from EventListeners of viewport EventControllers. Events are processed in the order they're received in ToolAdmin.eventLoop
   * @hidden
   */
  public addEvent(ev: Event, vp?: Viewport): void {
    const event = { ev, vp };
    if (!this.tryReplace(event)) // see if this event replaces the last event in the queue
      this.toolEvents.push(event); // otherwise put it at the end of the queue.
  }

  private recordKeyboardModifiers(ev: MouseEvent): void {
    const state = this.currentInputState;
    state.clearKeyQualifiers();
    if (ev.shiftKey)
      state.setKeyQualifier(BeModifierKeys.Shift, true);
    if (ev.ctrlKey)
      state.setKeyQualifier(BeModifierKeys.Control, true);
  }

  private getMousePosition(event: ToolEvent): Point2d {
    const ev = event.ev as MouseEvent;
    const rect = event.vp!.getClientRect();
    return Point2d.createFrom({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
  }

  private callMouseHandler(event: ToolEvent, isDown: boolean): Promise<any> {
    const ev = event.ev as MouseEvent;
    const vp = event.vp!;
    const pos = this.getMousePosition(event);

    this.recordKeyboardModifiers(ev);
    switch (ev.button) {
      case MouseButton.Middle: return isDown ? this.onMiddleButtonDown(vp, pos) : this.onMiddleButtonUp(vp, pos);
      case MouseButton.Right: return isDown ? this.onResetButtonDown(vp, pos) : this.onResetButtonUp(vp, pos);
    }
    return isDown ? this.onDataButtonDown(vp, pos, InputSource.Mouse) : this.onDataButtonUp(vp, pos, InputSource.Mouse);
  }

  private async callWheel(event: ToolEvent): Promise<EventHandled> {
    const ev = event.ev as WheelEvent;
    const vp = event.vp!;
    this.recordKeyboardModifiers(ev);

    if (ev.deltaY === 0)
      return EventHandled.No;

    let delta: number;
    switch (ev.deltaMode) {
      case ev.DOM_DELTA_PIXEL:
        delta = -ev.deltaY;
        break;
      case ev.DOM_DELTA_LINE:
        delta = -ev.deltaY * 40;
        break;
      default:
        delta = -ev.deltaY * 120;
        break;
    }

    return this.onWheel(vp, delta, this.getMousePosition(event));
  }

  private async callEventHandler(event: ToolEvent): Promise<any> {
    const vp = event.vp;
    switch (event.ev.type) {
      case "mousedown": return this.callMouseHandler(event, true);
      case "mouseup": return this.callMouseHandler(event, false);
      case "mousemove": return this.onMouseMotion(vp!, this.getMousePosition(event), InputSource.Mouse);
      case "mouseenter": return this.onMouseEnter(vp!);
      case "mouseleave": return this.onMouseLeave(vp!);
      case "wheel": return this.callWheel(event);
      case "keydown": return this.onKeyTransition(true, event);
      case "keyup": return this.onKeyTransition(false, event);
      // case "touchstart":
      // case "touchend":
      // case "touchmove":
      // case "touchcancel":
    }
    return;
  }

  private async processToolEvent(): Promise<any> {
    const ev = this.toolEvents.shift();
    if (undefined === ev)
      return;
    return this.callEventHandler(ev);
  }

  private _processingEvent = false;
  /**
   * Process a single event, but don't start work on new event unless the previous one has finished.
   * Also invokes timer events.
   */
  private async processEvent() {
    if (this._processingEvent)
      return; // we're still working on the previous event.

    this._processingEvent = true; // we can't allow any further event processing until the current event completes.
    try {
      await this.onTimerEvent(); // timer events are also suspended by asynchronous tool events. That's necessary since they can be asynchronous too.
      await this.processToolEvent();
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.log("error in event " + error.message);
      throw error;
    }

    this._processingEvent = false; // this event is now finished. Allow further event processing.
  }

  /** The main event processing loop for Tools (and rendering). */
  private static eventLoop(): void {
    if (!ToolAdmin._wantEventLoop) // flag turned on at startup
      return;

    IModelApp.toolAdmin.processEvent();
    IModelApp.viewManager.renderLoop();
    requestAnimationFrame(ToolAdmin.eventLoop);
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

  /** The current tool. May be viewing tool, input collector, primitive tool, or idle tool - in that priority order. */
  public get currentTool(): InteractiveTool { return this.activeTool ? this.activeTool : this.idleTool; }

  /** Ask the current tool to provide a tooltip message for the supplied HitDetail. */
  public async getToolTip(hit: HitDetail): Promise<string> { return this.currentTool.getToolTip(hit); }

  /**
   * Event that is raised whenever the active tool changes. This includes both primitive and viewing tools.
   * @param newTool The newly activated tool
   */
  public readonly activeToolChanged = new BeEvent<(tool: Tool) => void>();

  public getCursorView(): Viewport | undefined { return this.currentInputState.viewport; }
  public onAccuSnapEnabled() { }
  public onAccuSnapDisabled() { }
  public onAccuSnapSyncUI() { }

  /** Called when a viewport is closed */
  public onViewportClosed(vp: Viewport): void {
    // Closing the viewport may also delete the QueryModel so we have to prevent AccuSnap from trying to use it.
    IModelApp.accuSnap.clear();
    this.currentInputState.clearViewport(vp);
  }

  public initGestureEvent(ev: BeGestureEvent, vp: Viewport, gestureInfo: GestureInfo): void {
    const current = this.currentInputState;
    current.fromGesture(vp, gestureInfo, true);
    current.toEvent(ev, false);
    if (gestureInfo.isFromMouse)
      ev.actualInputSource = InputSource.Mouse;
    ev.gestureInfo = gestureInfo.clone();
  }

  private async onWheel(vp: Viewport, wheelDelta: number, pt2d: XAndY): Promise<any> {
    if (this.cursorView === undefined)
      return;

    vp.removeAnimator();

    this.currentInputState.fromButton(vp, pt2d, InputSource.Mouse, true);
    const wheelEvent = new BeWheelEvent();
    wheelEvent.wheelDelta = wheelDelta;
    this.currentInputState.toEvent(wheelEvent, true);
    return this.onWheelEvent(wheelEvent);
  }

  private async onWheelEvent(wheelEvent: BeWheelEvent): Promise<any> {
    const activeTool = this.activeTool;
    if (undefined === activeTool || EventHandled.Yes !== await activeTool.onMouseWheel(wheelEvent))
      return this.idleTool.onMouseWheel(wheelEvent);
  }

  private async onMouseEnter(vp: Viewport) { this.cursorView = vp; }
  private async onMouseLeave(vp: Viewport) {
    IModelApp.notifications.clearToolTip();
    this.cursorView = undefined;
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
  private async onTimerEvent(): Promise<void> {
    const tool = this.activeTool;

    const current = this.currentInputState;
    if (current.numberTouches !== 0 && !this.touchBridgeMode) {
      const touchMotionStopped = current.hasTouchMotionPaused;
      if (!touchMotionStopped)
        return;

      if (tool)
        tool.onTouchMotionPaused();

      return;
    }

    const ev = new BeButtonEvent();
    current.toEvent(ev, true);

    const wasMotion = current.wasMotion;
    if (!wasMotion) {
      if (tool)
        await tool.onModelNoMotion(ev);

      if (InputSource.Mouse === current.inputSource) {
        await IModelApp.accuSnap.onNoMotion(ev);
        // Application.accuDraw.onNoMotion(ev);
      }
    }

    if (current.hasMotionStopped) {
      if (tool)
        await tool.onModelMotionStopped(ev);
      if (InputSource.Mouse === current.inputSource) {
        IModelApp.accuSnap.onMotionStopped(ev);
      }
    }

    this.updateDynamics(ev);
  }

  private onMouseMotionEvent(ev: BeButtonEvent): boolean { return !this.filterButtonEvent(ev); }

  private async onMouseMotion(vp: Viewport, pt2d: XAndY, inputSource: InputSource): Promise<any> {
    const current = this.currentInputState;
    current.onMotion(pt2d);
    if (this.filterViewport(vp))
      return;

    const rawEvent = new BeButtonEvent();
    current.fromPoint(vp, pt2d, inputSource);
    current.toEvent(rawEvent, false);

    if (!this.onMouseMotionEvent(rawEvent)) {
      this.setIncompatibleViewportCursor(false);
      return;
    }

    await IModelApp.accuSnap.onMotion(rawEvent); // wait for AccuSnap before calling FromButton

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
        if (EventHandled.Yes !== await tool.onModelStartDrag(ev))
          return this.idleTool.onModelStartDrag(ev);
        return;
      }

      tool.onModelMotion(ev);
      this.updateDynamics(ev);
    } else {
      await this.idleTool.onModelStartDrag(ev);
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
    const point = snap.getPoint().clone();
    const savePt = point.clone();

    if (!isHot) // Want point adjusted to grid for a hit that isn't hot...
      this.adjustPointToGrid(point, vp);

    if (!IModelApp.accuDraw.adjustPoint(point, vp, isHot)) {
      if (vp.isSnapAdjustmentRequired())
        this.adjustPointToACS(point, vp, perpendicular || IModelApp.accuDraw.isActive());
    }

    if (!point.isExactEqual(savePt))
      snap.adjustedPoint.setFrom(point);
  }

  public async sendDataPoint(ev: BeButtonEvent): Promise<any> {
    const tool = this.activeTool;
    const current = this.currentInputState;
    if (!ev.isDown) {
      if (tool !== current.buttonDownTool)
        return; // Don't send tool UP event if it didn't get the DOWN event...

      if (tool)
        return tool.onDataButtonUp(ev);
    }

    current.buttonDownTool = tool;
    IModelApp.accuDraw.onPreDataButton(ev);

    if (tool)
      await tool.onDataButtonDown(ev);

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

  public async onDataButtonDown(vp: Viewport, pt2d: XAndY, inputSource: InputSource): Promise<any> {
    vp.removeAnimator();
    if (this.filterViewport(vp))
      return;

    const ev = new BeButtonEvent();
    const current = this.currentInputState;
    current.fromButton(vp, pt2d, inputSource, true);
    current.onButtonDown(BeButton.Data);
    current.toEvent(ev, true);
    current.updateDownPoint(ev);
    return this.sendDataPoint(ev);
  }

  public async onDataButtonUp(vp: Viewport, pt2d: XAndY, inputSource: InputSource): Promise<any> {
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
      if (undefined === tool || EventHandled.Yes !== await tool.onModelEndDrag(ev))
        return this.idleTool.onModelEndDrag(ev);
      return;
    }

    current.changeButtonToDownPoint(ev);
    return this.sendDataPoint(ev);
  }

  public async onMiddleButtonDown(vp: Viewport, pt2d: XAndY): Promise<any> {
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

    if (!tool || EventHandled.Yes !== await tool.onMiddleButtonDown(ev))
      return this.idleTool.onMiddleButtonDown(ev);
  }

  public async onMiddleButtonUp(vp: Viewport, pt2d: XAndY): Promise<any> {
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
      return EventHandled.No;

    if (wasDragging) {
      if (undefined === tool || EventHandled.No === await tool.onModelEndDrag(ev))
        return this.idleTool.onModelEndDrag(ev);
      return;
    }
    current.changeButtonToDownPoint(ev);
    if (!tool || EventHandled.No === await tool.onMiddleButtonUp(ev))
      return this.idleTool.onMiddleButtonUp(ev);
  }

  public async onResetButtonDown(vp: Viewport, pt2d: XAndY): Promise<any> {
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
      return tool.onResetButtonDown(ev);
  }

  public async onResetButtonUp(vp: Viewport, pt2d: XAndY): Promise<any> {
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
      if (undefined === tool || EventHandled.Yes !== await tool.onModelEndDrag(ev))
        return this.idleTool.onModelEndDrag(ev);
      return;
    }

    current.changeButtonToDownPoint(ev);
    if (tool)
      await tool.onResetButtonUp(ev);

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

  private async onModifierKeyTransition(wentDown: boolean, modifier: BeModifierKeys, event: KeyboardEvent) {
    if (wentDown === this.modifierKeyWentDown && modifier === this.modifierKey)
      return;

    const activeTool = this.activeTool;
    const changed = activeTool ? await activeTool.onModifierKeyTransition(wentDown, modifier, event) : false;

    this.modifierKey = modifier;
    this.modifierKeyWentDown = wentDown;

    if (!changed)
      return;

    this.updateDynamics();
  }

  private static getModifierKey(event: KeyboardEvent): BeModifierKeys {
    switch (event.key) {
      case "Alt": return BeModifierKeys.Alt;
      case "Shift": return BeModifierKeys.Shift;
      case "Control": return BeModifierKeys.Control;
    }
    return BeModifierKeys.None;
  }

  private async onKeyTransition(wentDown: boolean, event: ToolEvent): Promise<any> {
    const activeTool = this.activeTool;
    if (!activeTool)
      return;

    const keyEvent = event.ev as KeyboardEvent;
    const modifierKey = ToolAdmin.getModifierKey(keyEvent);
    if (BeModifierKeys.None !== modifierKey)
      return this.onModifierKeyTransition(wentDown, modifierKey, keyEvent);

    return activeTool.onKeyTransition(wentDown, keyEvent);
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
    IModelApp.accuDraw.onViewToolInstall();

    if (undefined !== this.viewTool) {
      this.setViewTool(undefined);
    } else {
      const tool = this.activeTool;
      if (tool)
        tool.onSuspend();
      this.suspendedByViewTool = new SuspendedToolState();
    }

    IModelApp.viewManager.invalidateDecorationsAllViews();

    this.toolState.coordLockOvr = CoordinateLockOverrides.All;
    this.toolState.locateCircleOn = false;

    IModelApp.accuSnap.onStartTool();

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

      if (undefined !== this.inputCollector && tool !== this.inputCollector)
        this.inputCollector.decorateSuspended(context);

      if (undefined !== this.primitiveTool && tool !== this.primitiveTool)
        this.primitiveTool.decorateSuspended(context);
    }

    const viewport = context.viewport;
    if (this.cursorView !== viewport)
      return;

    const ev = new BeButtonEvent();
    this.fillEventFromCursorLocation(ev);

    const hit = IModelApp.accuDraw.isActive() ? undefined : IModelApp.accuSnap.currHit; // NOTE: Show surface normal until AccuDraw becomes active...
    viewport.drawLocateCursor(context, ev.point, viewport.pixelsFromInches(IModelApp.locateManager.apertureInches), this.isLocateCircleOn(), hit);
  }

  public isLocateCircleOn(): boolean { return this.toolState.locateCircleOn && this.currentInputState.inputSource === InputSource.Mouse; }

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
  public async processWheelEvent(ev: BeWheelEvent, doUpdate: boolean): Promise<EventHandled> {
    await WheelEventProcessor.process(ev, doUpdate);
    this.updateDynamics(ev);
    IModelApp.viewManager.invalidateDecorationsAllViews();
    return EventHandled.Yes;
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
