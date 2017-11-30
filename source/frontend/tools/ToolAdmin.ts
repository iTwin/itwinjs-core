/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Point2d, Transform } from "@bentley/geometry-core/lib/PointVector";
import { NpcCenter } from "../../common/ViewState";
import { Viewport } from "../Viewport";
import { IdleTool } from "./IdleTool";
import { ViewTool, ViewToolSettings } from "./ViewTool";
import { BeDuration } from "@bentley/bentleyjs-core/lib/Time";
import { Constant } from "@bentley/geometry-core/lib/Constant";
import { EventList, Event } from "@bentley/bentleyjs-core/lib/Event";
import {
  ModifierKey, ButtonState, Button, GestureEvent, Tool, ButtonEvent, CoordSource, GestureInfo,
  Cursor, PrimitiveToolBase, WheelMouseEvent, InputSource, VirtualKey,
} from "./Tool";

export const enum CoordinateLockOverrides {
  OVERRIDE_COORDINATE_LOCK_None = 0,
  OVERRIDE_COORDINATE_LOCK_ACS = (1 << 1),
  OVERRIDE_COORDINATE_LOCK_Grid = (1 << 2),     // also overrides unit lock
  OVERRIDE_COORDINATE_LOCK_All = 0xffff,
}

export class ToolState {
  public coordLockOvr: CoordinateLockOverrides = CoordinateLockOverrides.OVERRIDE_COORDINATE_LOCK_None;
  public locateCircleOn: boolean = true;
}

export class CurrentInputState {
  private _rawPoint: Point3d = new Point3d();
  private _uorPoint: Point3d = new Point3d();
  private _viewPoint: Point3d = new Point3d();
  public qualifiers: ModifierKey;
  public motionTime: number;
  public viewport?: Viewport;
  public button: ButtonState[] = [new ButtonState(), new ButtonState(), new ButtonState()];
  public lastButton: Button = Button.Data;
  public inputSource: InputSource = InputSource.Unknown;
  public inputOffset: Point2d = new Point2d();
  public wantIgnoreTest: boolean = false;
  public numberTouches: number = 0;
  public touches: Point2d[] = [new Point2d(), new Point2d(), new Point2d()];
  public touchMotionTime: number = 0;
  public buttonDownTool?: Tool = undefined;
  private lastMotion = new Point2d();
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
  public get isShiftDown() { return 0 !== (this.qualifiers & ModifierKey.Shift); }
  public get isControlDown() { return 0 !== (this.qualifiers & ModifierKey.Control); }
  public get isAltDown() { return 0 !== (this.qualifiers & ModifierKey.Alt); }
  public isDragging(button: Button) { return this.button[button].isDragging; }
  public onStartDrag(button: Button) { this.button[button].isDragging = true; }
  public setKeyQualifier(qual: ModifierKey, down: boolean) { this.qualifiers = down ? (this.qualifiers | qual) : (this.qualifiers & (~qual)); }
  public clearKeyQualifiers() { this.qualifiers = ModifierKey.None; }
  public clearViewport(vp: Viewport) { if (vp === this.viewport) this.viewport = undefined; }
  private disableIgnoreTouchMotionTest() { this.wantIgnoreTest = false; }

  public clearTouch() {
    this.numberTouches = 0;
    this.touchMotionTime = 0;
    this.wantIgnoreTest = false;
  }

  public onMotion(pt2d: Point2d) {
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

  public changeButtonToDownPoint(ev: ButtonEvent) {
    ev.point = this.button[ev.button].downUorPt;
    ev.rawPoint = this.button[ev.button].downRawPt;

    if (ev.viewport)
      ev.viewPoint = ev.viewport.worldToView(ev.rawPoint);
  }

  public updateDownPoint(ev: ButtonEvent) {
    this.button[ev.button].downUorPt = ev.point;
  }

  public onButtonDown(button: Button) {
    const viewPt = this.viewport!.worldToView(this.button[button].downRawPt);
    const center = this.viewport!.npcToView(NpcCenter);
    viewPt.z = center.z;

    const now = Date.now();
    const isDoubleClick = ((now - this.button[button].downTime) < CurrentInputState.doubleClickTimeout)
      && (viewPt.distance(this.viewPoint) < CurrentInputState.doubleClickTolerance);

    this.button[button].init(this.uorPoint, this.rawPoint, now, true, isDoubleClick, false, this.inputSource);
    this.lastButton = button;
  }
  public onButtonUp(button: Button) {
    this.button[button].isDown = false;
    this.button[button].isDragging = false;
    this.lastButton = button;
  }

  public toEvent(ev: ButtonEvent, _useSnap: boolean) {
    const from = CoordSource.User;
    const uorPt = this.uorPoint.clone();
    const vp = this.viewport;

    // if (useSnap) {
    //   SnapDetailCP snap = TentativeOrAccuSnap:: GetCurrentSnap(false);

    //   if (nullptr != snap) {
    //     from = snap -> IsHot() ? DgnButtonEvent :: CoordSource:: ElemSnap: DgnButtonEvent:: CoordSource:: User;
    //     uorPt = snap -> GetAdjustedPoint(); // NOTE: Updated by AdjustSnapPoint even when not hot...
    //     vp = & snap -> GetViewport();
    //   }
    //   else if (TentativePoint:: GetInstance().IsActive())
    //   {
    //     from = DgnButtonEvent:: CoordSource:: TentativePoint;
    //     uorPt = * TentativePoint:: GetInstance().GetPoint();
    //     vp = TentativePoint:: GetInstance().GetViewport();
    //   }
    // }

    const buttonState = this.button[this.lastButton];
    ev.initEvent(uorPt, this.rawPoint, this.viewPoint, vp!, from, this.qualifiers, this.lastButton, buttonState.isDown, buttonState.isDoubleClick, this.inputSource);
  }

  public adjustLastDataPoint(ev: ButtonEvent) {
    const state = this.button[Button.Data];
    state.downUorPt = ev.point;
    state.downRawPt = ev.point;
    this.viewport = ev.viewport;
  }

  public toEventFromLastDataPoint(ev: ButtonEvent) {
    const state = this.button[Button.Data];
    const uorPt = state.downUorPt;
    const rawPt = state.downRawPt;
    const viewPt = this.viewport!.worldToView(rawPt);

    ev.initEvent(uorPt, rawPt, viewPt, this.viewport!, CoordSource.User, this.qualifiers, Button.Data, state.isDown, state.isDoubleClick, state.inputSource);
  }

  public fromPoint(vp: Viewport, pt: Point2d, source: InputSource) {
    this.viewport = vp;
    this._viewPoint.x = pt.x + this.inputOffset.x;
    this._viewPoint.y = pt.y + this.inputOffset.y;
    this._viewPoint.z = vp.npcToView(NpcCenter).z;
    vp.viewToWorld(this._viewPoint, this._rawPoint);
    this._uorPoint = this._rawPoint;
    this.inputSource = source;
  }

  public fromButton(vp: Viewport, pt: Point2d, source: InputSource, _applyLocks: boolean) {
    this.fromPoint(vp, pt, source);

    // // NOTE: Using the hit point on the element is preferable to ignoring a snap that is not "hot" completely...
    // if (nullptr != TentativeOrAccuSnap:: GetCurrentSnap(false))
    // {
    //   if (applyLocks)
    //     t_viewHost -> GetToolAdmin()._AdjustSnapPoint();

    //   return;
    // }

    // t_viewHost -> GetToolAdmin()._AdjustPoint(m_uorPoint, vp, true, applyLocks);
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

  public isStartDrag(button: Button): boolean {
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

  public ignoreTouchMotion(numberTouches: number, touches: Point2d[]) {
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

  public onTouchMotionChange(numberTouches: number, touches: Point2d[]) {
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
  private _toolEvents = new EventList();
  public static instance = new ToolAdmin();
  public currentInputState = new CurrentInputState();
  public toolState = new ToolState();
  private viewCursor?: Cursor;
  private viewTool?: ViewTool;
  private primitiveTool?: PrimitiveToolBase;
  private idleTool: IdleTool;
  private inputCollector?: Tool;
  private defaultTool?: PrimitiveToolBase;
  private cursorInView: boolean;
  public gesturePending: boolean;
  // elementLocateManager: ElementLocateManager;
  // fenceManager: FenceManager;
  // accuSnap: AccuSnap;
  // tentPoint: TentativePoint;
  // accuDraw: AccuDraw;
  private modifierKeyWentDown: boolean;
  private modifierKey: ModifierKey;
  private touchBridgeMode: boolean; // Flag indicating that touch events are being converted into mouse events for this tool

  protected filterViewport(_vp: Viewport) { return false; }
  public onInstallTool(tool: Tool) { this.currentInputState.clearKeyQualifiers(); return tool.onInstall(); }
  public onPostInstallTool(tool: Tool) { tool.onPostInstall(); }

  public get activeViewTool(): ViewTool | undefined { return this.viewTool; }
  public get activeTool(): Tool | undefined {
    return this.viewTool ? this.viewTool : (this.inputCollector ? this.inputCollector : this.primitiveTool); // NOTE: Viewing tools suspend input collectors as well as primitives...
  }

  /**
   * Event that is raised whenever the active tool changes. This includes both primitive and viewing tools.
   * @param newTool The newly activated tool
   */
  public get activeToolChanged(): Event<(newTool: Tool) => void> { return this._toolEvents.get("activeTool"); }

  /** called when a viewport is closed */
  public onViewportClosed(vp: Viewport): void {
    //  Closing the viewport may also delete the QueryModel so we have to prevent
    //  AccuSnap from trying to use it.
    //    AccuSnap:: GetInstance().Clear();
    this.currentInputState.clearViewport(vp);
  }

  public initGestureEvent(ev: GestureEvent, vp: Viewport, gestureInfo: GestureInfo): void {
    const current = this.currentInputState;
    current.fromGesture(vp, gestureInfo, true);
    current.toEvent(ev, false);
    if (gestureInfo.isFromMouse)
      ev.actualInputSource = InputSource.Mouse;
  }

  public onWheel(vp: Viewport, wheelDelta: number, pt2d: Point2d): void {
    vp.removeAnimator();
    this.currentInputState.fromButton(vp, pt2d, InputSource.Mouse, true);
    const wheelEvent = new WheelMouseEvent();
    wheelEvent.wheelDelta = wheelDelta;
    this.currentInputState.toEvent(wheelEvent, true);
    this.onWheelEvent(wheelEvent);
  }

  public onWheelEvent(wheelEvent: WheelMouseEvent): void {
    const activeTool = this.activeTool;
    if (!activeTool || !activeTool.onMouseWheel(wheelEvent))
      this.idleTool.onMouseWheel(wheelEvent);
  }

  private static scratchButtonEvent1 = new ButtonEvent();
  private static scratchButtonEvent2 = new ButtonEvent();
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
        // AccuSnap:: GetInstance().OnNoMotion(event);
        // AccuDraw:: GetInstance()._OnNoMotion(event);
      }
    }

    if (current.hasMotionStopped) {
      if (tool)
        tool.onModelMotionStopped(ev);
      if (InputSource.Mouse === current.inputSource) {
        //   AccuSnap:: GetInstance().OnMotionStopped(event);
      }
    }

    if (tool)
      tool.updateDynamics(ev);

    ev.reset();
    return !wasMotion;  // return value unused...
  }

  public onMouseMotion(vp: Viewport, pt2d: Point2d, inputSource: InputSource): void {
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
    if (primitiveTool instanceof PrimitiveToolBase)
      primitiveTool.updateDynamics(ev);

    ev.reset();
  }

  public sendDataPoint(ev: ButtonEvent): void {
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
    //    AccuDraw:: GetInstance()._OnPreDataButton(event);

    if (tool)
      tool.onDataButtonDown(ev);

    // TentativePoint:: GetInstance().OnButtonEvent();
    // AccuDraw:: GetInstance()._OnPostDataButton(event);
    if (!(tool instanceof PrimitiveToolBase))
      return;

    tool.autoLockTarget(); // lock tool to target model of this view...

    // Don't use event, need to account for point location adjusted to hit point on element by tools...
    const scratchEv = ToolAdmin.scratchButtonEvent2;
    current.toEventFromLastDataPoint(scratchEv);
    tool.updateDynamics(scratchEv);
  }

  private filterButtonEvent(ev: ButtonEvent): boolean {
    const vp = ev.viewport;
    if (!vp)
      return false;

    const tool = this.activeTool;
    if (!tool)
      return false;

    return !tool.isCompatibleViewport(vp, false);
  }

  private onButtonEvent(ev: ButtonEvent): boolean {
    if (this.filterButtonEvent(ev))
      return false;

    if (Button.Data !== ev.button)
      return true;

    const tool = this.activeTool;
    return (!tool ? true : tool.isValidLocation(ev, true));
  }

  public onDataButtonDown(vp: Viewport, pt2d: Point2d, inputSource: InputSource): void {
    vp.removeAnimator();
    if (this.filterViewport(vp))
      return;

    const ev = ToolAdmin.scratchButtonEvent1;
    const current = this.currentInputState;
    current.fromButton(vp, pt2d, inputSource, true);
    current.onButtonDown(Button.Data);
    current.toEvent(ev, false);
    current.updateDownPoint(ev);
    this.sendDataPoint(ev);
    ev.reset();
  }

  public onDataButtonUp(vp: Viewport, pt2d: Point2d, inputSource: InputSource): void {
    if (this.filterViewport(vp))
      return;

    const current = this.currentInputState;
    const wasDragging = current.isDragging(Button.Data);

    const ev = ToolAdmin.scratchButtonEvent1;
    current.fromButton(vp, pt2d, inputSource, true);
    current.onButtonUp(Button.Data);
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

  public onMiddleButtonDown(vp: Viewport, pt2d: Point2d): void {
    if (this.filterViewport(vp))
      return;

    vp.removeAnimator();
    const ev = ToolAdmin.scratchButtonEvent1;
    const current = this.currentInputState;
    current.fromButton(vp, pt2d, InputSource.Mouse, true);
    current.onButtonDown(Button.Middle);
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

  public onMiddleButtonUp(vp: Viewport, pt2d: Point2d): void {
    if (this.filterViewport(vp))
      return;

    const current = this.currentInputState;
    const wasDragging = current.isDragging(Button.Middle);

    const ev = ToolAdmin.scratchButtonEvent1;
    current.fromButton(vp, pt2d, InputSource.Mouse, true);
    current.onButtonUp(Button.Middle);
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

  public onResetButtonDown(vp: Viewport, pt2d: Point2d): void {
    if (this.filterViewport(vp))
      return;

    vp.removeAnimator();
    const ev = ToolAdmin.scratchButtonEvent1;
    const current = this.currentInputState;
    current.fromButton(vp, pt2d, InputSource.Mouse, true);
    current.onButtonDown(Button.Reset);
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

  public onResetButtonUp(vp: Viewport, pt2d: Point2d): void {
    if (this.filterViewport(vp))
      return;

    const current = this.currentInputState;
    const wasDragging = current.isDragging(Button.Reset);

    const ev = ToolAdmin.scratchButtonEvent1;
    current.fromButton(vp, pt2d, InputSource.Mouse, true);
    current.onButtonUp(Button.Reset);
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
    //    TentativePoint:: GetInstance().OnButtonEvent();
  }

  private scratchGestureEvent = new GestureEvent();
  private onGestureEvent(ev: GestureEvent): boolean { return (!this.filterButtonEvent(ev)); }
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
    //    AccuSnap:: GetInstance().Clear();
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

  public onModifierKeyTransition(wentDown: boolean, key: ModifierKey) {
    if (wentDown === this.modifierKeyWentDown && key === this.modifierKey)
      return;

    const activeTool = this.activeTool;
    const changed = activeTool ? activeTool.onModifierKeyTransition(wentDown, key) : false;

    this.modifierKey = key;
    this.modifierKeyWentDown = wentDown;

    if (!changed)
      return;

    // Give active tool a chance to update it's dynamics...
    if (activeTool instanceof PrimitiveToolBase) {
      const ev = ToolAdmin.scratchButtonEvent1;
      this.fillEventFromCursorLocation(ev);
      activeTool.updateDynamics(ev);
    }
  }

  private static getModifierKeyFromVirtualKey(key: VirtualKey): ModifierKey {
    switch (key) {
      case VirtualKey.Alt: return ModifierKey.Alt;
      case VirtualKey.Shift: return ModifierKey.Shift;
      case VirtualKey.Control: return ModifierKey.Control;
    }
    return ModifierKey.None;
  }

  public onKeyTransition(wentDown: boolean, key: VirtualKey): boolean {
    const activeTool = this.activeTool;
    if (!activeTool)
      return false;

    if (VirtualKey.Shift === key || VirtualKey.Control === key || VirtualKey.Alt === key) {
      this.onModifierKeyTransition(wentDown, ToolAdmin.getModifierKeyFromVirtualKey(key));
      return true;
    }

    const current = this.currentInputState;
    return activeTool.onKeyTransition(wentDown, key, current.isShiftDown, current.isControlDown);
  }

  public setPrimitiveTool(primitiveTool?: PrimitiveToolBase) {
    const prevActiveTool = this.activeTool;
    if (this.primitiveTool) {
      this.primitiveTool.onCleanup();
      //      t_viewHost -> GetViewManager().EndDynamicsMode();
    }

    this.invalidateLastWheelEvent();
    this.primitiveTool = primitiveTool;

    const newActiveTool = this.activeTool;
    if (newActiveTool !== prevActiveTool)
      this.activeToolChanged.raiseEvent(newActiveTool);
  }

  /** Invoked by ViewTool.installToolImplementation */
  public setViewTool(newTool?: ViewTool) {
    if (this.viewTool)
      this.viewTool.onCleanup();

    this.invalidateLastWheelEvent();
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

    // AccuDraw:: GetInstance()._OnViewToolExit();

    // DgnPrimitiveTool * primitiveTool = dynamic_cast < DgnPrimitiveTool *> (GetActiveTool());
    // if (nullptr != primitiveTool) {
    //   DgnButtonEvent ev;
    //   _FillEventFromCursorLocation(ev);
    //   primitiveTool -> UpdateDynamics(ev);
    // }
  }

  public startViewTool() {
    if (this.viewTool)
      this.setViewTool(undefined);
    // else
    //   this.suspendedCursor = this.viewCursor;

    // AccuSnap:: GetInstance().OnStartTool();

    this.setViewCursor(Cursor.CrossHair);
    // we don't actually start the tool here...
  }

  public startPrimitiveTool(newTool: PrimitiveToolBase) {
    this.exitViewTool();
    if (this.primitiveTool)
      this.setPrimitiveTool(undefined);

    // this.exitInputCollector();
    // this.setIncompatibleViewportCursor(true); // Don't restore this...
    // AccuDraw:: GetInstance()._OnPrimitiveToolInstall();
    // AccuSnap:: GetInstance().OnStartTool();

    this.setViewCursor(newTool.getCursor());

    // we don't actually start the tool here...
  }

  /** establish the default tool */
  public setDefaultTool(tool: PrimitiveToolBase) { this.defaultTool = tool; }
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
      this.setViewCursor(Cursor.Default);
    }
  }

  public setViewCursor(cursor?: Cursor) {
    cursor = cursor ? cursor : Cursor.Default;
    this.viewCursor = cursor;
    // const canvas = this.viewport.canvas;
    // canvas.style.cursor = cursor;
  }

  public fillEventFromCursorLocation(ev: ButtonEvent) { this.currentInputState.toEvent(ev, true); }
  public fillEventFromDataButton(ev: ButtonEvent) { this.currentInputState.toEventFromLastDataPoint(ev); }
  public fillEventFromLastDataButton(ev: ButtonEvent) { this.currentInputState.toEventFromLastDataPoint(ev); }
  public setAdjustedDataPoint(ev: ButtonEvent) { this.currentInputState.adjustLastDataPoint(ev); }

  public convertGestureSingleTapToButtonDownAndUp(ev: GestureEvent) {
    this.touchBridgeMode = true;

    const displayPoint = ev.getDisplayPoint();
    const vp = ev.viewport!;
    this.onDataButtonDown(vp, displayPoint, InputSource.Touch);
    this.onDataButtonUp(vp, displayPoint, InputSource.Touch);
    this.touchBridgeMode = false;
  }

  public convertGestureToResetButtonDownAndUp(ev: GestureEvent) {
    this.touchBridgeMode = true;

    const displayPoint = ev.getDisplayPoint();
    const vp = ev.viewport!;
    this.onResetButtonDown(vp, displayPoint);
    this.onResetButtonUp(vp, displayPoint);
    this.touchBridgeMode = false;
  }

  public convertGestureMoveToButtonDownAndMotion(ev: GestureEvent) {
    this.touchBridgeMode = true;
    const vp = ev.viewport!;
    if (0 === ev.gestureInfo!.previousNumberTouches)
      this.onDataButtonDown(vp, ev.getDisplayPoint(), InputSource.Touch);
    else
      this.onMouseMotion(vp, ev.getDisplayPoint(), InputSource.Touch);
  }

  public convertGestureEndToButtonUp(ev: GestureEvent) {
    this.onDataButtonUp(ev.viewport!, ev.getDisplayPoint(), InputSource.Touch);
    this.touchBridgeMode = false;
  }

  private wheelEventProcessor = new WheelEventProcessor();

  /** Performs default handling of mouse wheel event (zoom in/out) */
  public processMouseWheelEvent(ev, doUpdate): boolean {
    this.wheelEventProcessor.ev = ev;
    const result = this.wheelEventProcessor.process(doUpdate);
    this.wheelEventProcessor.ev = undefined;
    return result;
  }

  private invalidateLastWheelEvent() { this.wheelEventProcessor.invalidateLastEvent(); }
}

// tslint:disable-next-line:variable-name
export const MouseWheelSettings = {
  zoomRatio: 1.75,
  navigateDistPct: 3.0,
  navigateMouseDistPct: 10.0,
};

class WheelEventProcessor {
  constructor(public ev?: WheelMouseEvent) { }
  public process(_doUpdate: boolean): boolean { this.doZoom(false); return true; }

  public doZoom(reCenter: boolean) {
    const ev = this.ev!;
    let zoomRatio = Math.max(1.0, MouseWheelSettings.zoomRatio);

    const wheelDelta = ev.wheelDelta;
    if (wheelDelta > 0)
      zoomRatio = 1.0 / zoomRatio;

    const vp = ev.viewport!;
    const view = vp.view;
    const startFrust = vp.getFrustum();

    const zoomCenter = vp.getZoomCenter(ev.viewport);

    if (vp.pickEntity(ev.viewPoint, ViewToolSettings.pickSize) {
      scratch.zoomTarget = target.clone();
    } else if (!scratch.zoomTarget.equals(new Cartesian3())) {
      target = scratch.zoomTarget.clone();
    } else {
      vp.determineDefaultRotatePoint(target);
      scratch.zoomTarget = target.clone();
    }

    const targetRoot = target.clone();
    const lastEvent = this._lastWheelEvent;
    const lastEventValid = lastEvent && lastEvent.viewPoint.distanceSquaredXY(ev.viewPoint) < Constants.mgds_fc_epsilon;

    if (view.is3d() && view.isCameraOn()) {
      vp.worldToNpc(targetRoot, targetRoot);
      let defaultTarget: Point3d | undefined;

      if (lastEventValid) {
        defaultTarget = vp.worldToNpc(lastEvent.worldPoint);
        targetRoot.z = defaultTarget.z;
      } else {
        defaultTarget = vp.pickDepthBuffer(ev.viewPoint, new Point3d(), true);
        if (defaultTarget) {
          vp.worldToNpc(defaultTarget, targetRoot);
        } else {
          defaultTarget = vp.determineDefaultRotatePoint();
          vp.worldToNpc(defaultTarget, defaultTarget);
          targetRoot.z = defaultTarget.z;
        }
      }

      vp.npcToWorld(targetRoot, targetRoot);

      const transform = Transform.createScaleAboutPoint(targetRoot, zoomRatio);
      const oldCameraPos = view.getEyePoint().clone();
      const newCameraPos = transform.multiplyPoint(oldCameraPos);
      const offset = newCameraPos.minus(oldCameraPos);
      if (offset.magnitude() < Constant.oneCentimeter) {
        offset.scaleInPlace(Constant.oneMeter / 3.0);
        targetRoot.plus(offset, targetRoot);
      }

      target.setFrom(view.getTargetPoint());
      target.plus(offset, target);
      oldCameraPos.plus(offset, newCameraPos);

      // if (vp.pointIsBelowSurface(newCameraPos)) {
      //   vp.movePointToSurface(newCameraPos);
      //   offset = Cartesian3.fromDifferenceOf(newCameraPos, oldCameraPos);
      //   target.copyFrom(view.targetPoint);
      //   target.add(offset);
      // }

      const result = view.lookAt(newCameraPos, target, view.getYVector());
      vp.synchWithView(false);
      if (ViewToolSettings.animateZoom)
        vp.animateFrustumChange(startFrust, vp.getFrustum(), BeDuration.fromMilliseconds(100));

      return result;
    }

    if (lastEventValid)
      targetRoot.setFrom(lastEvent.worldPoint);

    const targetNpc = vp.worldToNpc(targetRoot);
    const trans = Matrix4.fromFixedPointAndScaleFactors(targetNpc, zoomRatio, zoomRatio, 1.0);
    const viewCenter = new Cartesian3(0.5, 0.5, 0.5);

    if (reCenter) {
      const shift = Cartesian3.fromDifferenceOf(targetNpc, viewCenter);
      shift.z = 0.0;

      const offset = Matrix4.fromMatrixAndTranslation(undefined, shift);
      trans.initProduct(trans, offset);
    }

    trans.multiplyByPoint(viewCenter, viewCenter);
    viewCenter = vp.npcToWorld(viewCenter, viewCenter);

    if (!lastEventValid && false)
      this._lastWheelEvent = { viewPoint: ev.viewPoint.clone(), worldPoint: viewCenter };

    return vp.zoom(viewCenter, zoomRatio);
  }

  public invalidateLastEvent() { this._lastWheelEvent = undefined; }
  public doWheelPan(upDown: boolean) { }
  public doWheelSlide(upDown: boolean) { }
  public doWheelNavigate(isWalk: boolean) { }
}
