/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Viewport } from "../Viewport";
import { GestureId, GestureInfo, ModifierKey, InputSource } from "./Tool";
import { ToolAdmin } from "./ToolAdmin";
import { Point2d } from "@bentley/geometry-core/lib/PointVector";

const enum MouseButton {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,
}

const enum TouchConstants {
  TAP_LIMIT = 800,
  TAP_CONFIRM_SINGLE_LIMIT = 200,
  TAP_INVALID_UP_TIME = 0xffffffff,
  LONG_PRESS_LIMIT = 500,
  INITIAL_MOVE_THRESHOLD = 0.09,
  DOUBLE_TAP_DIST_THRESHOLD = 0.25,
  TICK = 16 / 1000,  // 16ms
}

const enum TouchState {
  Invalid = 0,
  Initial = 1,
  FirstDown = 2,         //  Received first down and nothing since
  SecondDown = 3,        //  Received a down while in FirstDown or SecondDown state
  TapPending = 4,        //  Received down and up with nothing in between that excludes tap
  SecondTapDown = 5,     //  Received a down while in TapPending state
  SecondDownOneUp = 6,   //  Received an up while still have a possibility of a 2 finger tap
  MovePending = 7,       //  Move is the only allowable operation from the current state
  Moving = 8,
  InLongPress = 9,
  InLongPressAwaitingTap = 10,
}

const enum TapEventType {
  OneFingerSingleTap = 0,
  OneFingerDoubleTap = 1,
  TwoFingerSingleTap = 2,
}

const toolAdmin = ToolAdmin.instance;

// /*---------------------------------------------------------------------------------**//**
// * @private
// * @bsimethod                                                    Paul.Connelly   11/16
// +---------------+---------------+---------------+---------------+---------------+------*/
// function reportStateTransition(newState, oldState) {
//   if (TouchConstants.DEBUG_TRACE) {
//     const stateName = 'UNRECOGNIZED';
//     for (const name in TouchState) {
//       if (TouchState[name] === newState) {
//         stateName = name;
//         break;
//       }
//     }

//     console.log('TouchHandler new state: ' + stateName);
//   }
// };

class TouchPoint extends Point2d {
  public initialX: number;
  public initialY: number;
  public previousTime: number;
  public velocityX: number;
  public velocityY: number;
  public updated: boolean;

  constructor(x: number = 0, y: number = 0, public pointId?: number, public downTime: number = 0) {
    super(x, y);
    this.initialX = this.x;
    this.initialY = this.y;
    this.previousTime = this.downTime;
    this.velocityX = 0;
    this.velocityY = 0;
    this.updated = false;
  }

  public static touchExceedsThreshold(actualPixels: number, thresholdInches: number, vp: Viewport) {
    const thresholdPixels = vp.pixelsFromInches(thresholdInches);
    return actualPixels >= thresholdPixels;
  }

  public copyFrom(src: TouchPoint): void {
    this.x = src.x;
    this.y = src.y;
    this.initialX = src.initialX;
    this.initialY = src.initialY;
    this.pointId = src.pointId;
    this.downTime = src.downTime;
    this.previousTime = src.previousTime;
    this.velocityX = src.velocityX;
    this.velocityY = src.velocityY;
    this.updated = src.updated;
  }

  public clone(result?: TouchPoint): TouchPoint {
    const clone = result ? result : new TouchPoint();
    clone.copyFrom(this);
    return clone;
  }

  public get changed() { return this.updated; }

  public update(x: number, y: number, vp: Viewport) {
    const threshold = TouchConstants.INITIAL_MOVE_THRESHOLD;
    if (!this.updated && !TouchPoint.touchExceedsThreshold(Math.abs(x - this.initialX), threshold, vp) && !TouchPoint.touchExceedsThreshold(Math.abs(y - this.initialY), threshold, vp))
      return false;

    const current = Date.now();
    const timeDelta = current - this.previousTime;
    if (timeDelta > 2.0) {
      this.previousTime = current;
      const xVelocity = (x - this.x) / timeDelta;
      const yVelocity = (y - this.y) / timeDelta;
      if (this.velocityX !== 0.0) {
        const oldFactor = 0.2;
        const currentFactor = 0.8;

        this.velocityX = oldFactor * this.velocityX + currentFactor * xVelocity;
        this.velocityY = oldFactor * this.velocityY + currentFactor * yVelocity;
      } else {
        this.velocityX = xVelocity;
        this.velocityY = yVelocity;
      }
    }

    this.updated = true;
    this.x = x;
    this.y = y;
    return true;
  }
}

class TouchHandlerEventQueue {
  public queue: GestureInfo[] = [];

  public push(info: GestureInfo) {
    // Try to replace the last entry in the queue
    if (this.queue.length === 0 || !this.tryReplace(this.queue[this.queue.length - 1], info))
      this.queue.push(info.clone());
  }

  public tryReplace(existing: GestureInfo, replacement: GestureInfo): boolean {
    if (existing.isEndGesture)
      return false;

    const gestureId = existing.gestureId;
    if (replacement.gestureId !== gestureId)
      return false;

    switch (gestureId) {
      case GestureId.SingleFingerMove:
      case GestureId.MultiFingerMove:
        if (existing.numberTouches === replacement.numberTouches && existing.previousNumberTouches === replacement.previousNumberTouches) {
          replacement.copyFrom(existing);
          return true;
        }
        break;
    }

    return false;
  }

  public process(vp: Viewport): void {
    const len = this.queue.length;
    if (len > 0) {
      for (let i = 0; i < len; i++)
        this.dispatch(this.queue[i], vp);

      this.queue.length = 0;
    }
  }

  public dispatch(info: GestureInfo, vp: Viewport): void {
    if (info.isEndGesture) {
      toolAdmin.onEndGesture(vp, info);
      return;
    }

    switch (info.gestureId) {
      case GestureId.MultiFingerMove: return toolAdmin.onMultiFingerMove(vp, info);
      case GestureId.SingleFingerMove: return toolAdmin.onSingleFingerMove(vp, info);
      case GestureId.TwoFingerTap: return toolAdmin.onTwoFingerTap(vp, info);
      case GestureId.PressAndTap: return toolAdmin.onPressAndTap(vp, info);
      case GestureId.SingleTap: return toolAdmin.onSingleTap(vp, info);
      case GestureId.DoubleTap: return toolAdmin.onDoubleTap(vp, info);
      case GestureId.LongPress: return toolAdmin.onLongPress(vp, info);
    }
  }
}

/** Aggregates touch inputs and forwards to tool admin. */
class TouchHandler {
  public touchPoints: TouchPoint[] = [];
  public previousNumberTouches: number = 0;
  public firstDown = new TouchPoint();
  public lastUp = new TouchPoint();
  public firstTap1 = new TouchPoint();  // 1- and 2-finger taps
  public firstTap2 = new TouchPoint();  // 2-finger taps only
  public secondTap1 = new TouchPoint(); // 1- and 2-finger taps
  public secondTap2 = new TouchPoint(); // 2-finger taps only
  public queue = new TouchHandlerEventQueue();
  public lastTouchEventTime: number = 0;
  public timerTime = Date.now();
  public tapDownTime: number;
  public tapUpTime: number;
  public lastDown: number;
  public state: TouchState;
  public interpretingDataButtonAsTouch: boolean;
  public endGestureId: GestureId;

  constructor(public viewport: Viewport) {
    this.initializeHandler();
  }

  public initializeHandler(): void {
    this.tapDownTime = 0;
    this.tapUpTime = 0;
    this.touchPoints.length = 0;
    this.state = TouchState.Initial;
    this.interpretingDataButtonAsTouch = false;
    this.endGestureId = GestureId.None;
  }

  public isDestroyed(): boolean { return false; }

  public update(): void {
    const now = Date.now();
    if ((now - this.timerTime) >= TouchConstants.TICK) {
      this.timerTime = now;
      this.timerExpired();
    }
  }

  public getPreviousNumberTouches(update: boolean): number {
    const val = this.previousNumberTouches;
    if (update)
      this.previousNumberTouches = this.touchPoints.length;
    return val;
  }

  public setState(newState: TouchState): void {
    //  reportStateTransition(newState, this.state);
    if (TouchState.Invalid === newState) {
      if (0 !== this.endGestureId && (0 !== this.touchPoints.length || 0 !== this.previousNumberTouches))
        this.sendEndGestureEvent(this.endGestureId, this.touchPoints[0].x, this.touchPoints[0].y, this.touchPoints, this.interpretingDataButtonAsTouch);

      this.previousNumberTouches = 0;
    }

    if (TouchState.Initial === newState || TouchState.Invalid === newState)
      this.initializeHandler();

    this.state = newState;
  }

  private static scratchGestureInfo = new GestureInfo();
  public initGestureInfo(gestureId: GestureId, centerX: number, centerY: number, distance: number, points: TouchPoint[], isEnding: boolean, isFromMouse: boolean) {
    const info = TouchHandler.scratchGestureInfo;
    info.init(gestureId, centerX, centerY, distance, points, isEnding, isFromMouse, this.getPreviousNumberTouches(true));
    return info;
  }

  public sendEvent(info: GestureInfo) {
    this.queue.push(info);
  }

  public sendEndGestureEvent(gestureId: GestureId, x: number, y: number, points: TouchPoint[], isFromMouse: boolean) {
    const info = this.initGestureInfo(gestureId, x, y, 0.0, points, true, isFromMouse);
    this.sendEvent(info);
  }

  public touchCanceled(): void { this.setState(TouchState.Invalid); }
  public onTouchEvent(): void { this.lastTouchEventTime = Date.now(); }

  public getPoint(id: number): TouchPoint | undefined {
    for (const cur of this.touchPoints) {
      if (cur.pointId === id)
        return cur;
    }

    return undefined;
  }

  public removePoint(id: number): boolean {
    for (let i = 0; i < this.touchPoints.length; i++) {
      const cur = this.touchPoints[i];
      if (cur.pointId === id) {
        this.touchPoints.splice(i, 1);
        return true;
      }
    }

    return false;
  }

  public touchDown(x: number, y: number, id: number, numberFingers: number, interpretingDataButtonAsTouch: boolean) {
    this.onTouchEvent();

    if (numberFingers <= this.touchPoints.length) {
      // We lost some transition. Doing nothing is better than doing the wrong thins.
      this.setState(TouchState.Invalid);
    }

    if (this.state === TouchState.Invalid)
      this.setState(TouchState.Initial);

    if (interpretingDataButtonAsTouch)
      this.interpretingDataButtonAsTouch = true;

    const eventTime = Date.now();
    this.touchPoints.push(new TouchPoint(x, y, id, eventTime));
    if (this.touchPoints.length === 1)
      this.firstDown.copyFrom(this.touchPoints[0]);

    this.lastDown = id;

    switch (this.state) {
      case TouchState.Initial:
        this.previousNumberTouches = 0;
        this.tapDownTime = eventTime;
        this.tapUpTime = TouchConstants.TAP_INVALID_UP_TIME;
        this.setState(TouchState.FirstDown);
        break;
      case TouchState.FirstDown:
        this.setState(TouchState.SecondDown);
        break;
      case TouchState.SecondDown:
        this.setState(TouchState.MovePending);
        break;
      case TouchState.TapPending:
        this.setState(TouchState.SecondTapDown);
        break;
      case TouchState.SecondTapDown:
        this.setState(TouchState.Invalid);
        break;
      case TouchState.SecondDownOneUp:
        this.setState(TouchState.Moving);
        break;
      case TouchState.Moving:
        break;  // no state changes once we start moving.
      case TouchState.InLongPress:
        this.firstTap1.copyFrom(this.touchPoints[0]);
        this.setState(TouchState.InLongPressAwaitingTap);
        break;
      case TouchState.InLongPressAwaitingTap:
        this.setState(TouchState.Invalid);
        break;
    }
  }

  public touchUp(id: number): void {
    this.onTouchEvent();
    const interpretingDataButtonAsTouch = this.interpretingDataButtonAsTouch;

    const upPoint = this.getPoint(id);
    if (!upPoint)
      this.setState(TouchState.Invalid);

    const handlerState = this.state;
    if (TouchState.Invalid === handlerState)
      return;

    const eventTime = Date.now();
    switch (handlerState) {
      case TouchState.Initial:
      case TouchState.TapPending:
        break;
      case TouchState.FirstDown:
        const interval1 = eventTime - this.tapDownTime;
        if (interval1 < TouchConstants.TAP_LIMIT) {
          this.setState(TouchState.TapPending);
          this.tapUpTime = eventTime;
          this.firstTap1.copyFrom(upPoint!);
        } else {
          this.setState(TouchState.Initial);
        }
        break;
      case TouchState.SecondTapDown:
        const interval2 = eventTime - this.tapDownTime;
        if (interval2 < TouchConstants.TAP_LIMIT) {
          this.tapUpTime = eventTime;
          this.secondTap1.copyFrom(upPoint!);
          this.handleTaps(true);
        }

        this.setState(TouchState.Initial);
        break;
      case TouchState.SecondDown:
        const interval3 = eventTime - this.tapDownTime;
        if (interval3 > TouchConstants.TAP_LIMIT) {
          this.setState(TouchState.Invalid);
          break;
        }

        this.firstTap1.copyFrom(upPoint!);
        this.setState(TouchState.SecondDownOneUp);
        break;
      case TouchState.SecondDownOneUp:
        const interval = eventTime - this.tapDownTime;
        if (interval > TouchConstants.TAP_LIMIT) {
          this.setState(TouchState.Invalid);
          break;
        }

        this.firstTap2.copyFrom(upPoint!);
        this.handle2FingerTap();
        this.setState(TouchState.Initial);
        break;
      case TouchState.MovePending:
        if (this.touchPoints.length === 1)
          this.setState(TouchState.Initial);
        break;
      case TouchState.Moving:
        if (this.touchPoints.length === 1) {
          const endGestureId1 = this.endGestureId;
          const touchPoint1 = this.touchPoints[0];
          this.setState(TouchState.Initial);
          this.sendEndGestureEvent(endGestureId1, touchPoint1.x, touchPoint1.y, this.touchPoints, interpretingDataButtonAsTouch);
        }
        break;
      case TouchState.InLongPress:
        const endGestureId = (GestureId.PressAndTap !== this.endGestureId) ? GestureId.LongPress : this.endGestureId;
        const touchPoint = this.touchPoints[0];
        this.setState(TouchState.Initial);
        this.sendEndGestureEvent(endGestureId, touchPoint.x, touchPoint.y, this.touchPoints, interpretingDataButtonAsTouch);
        break;
      case TouchState.InLongPressAwaitingTap:
        if (upPoint!.pointId === this.firstTap1.pointId) {
          this.setState(TouchState.Invalid);
          break;
        }

        this.handlePressAndTap();
        this.setState(TouchState.InLongPress);
        this.endGestureId = GestureId.PressAndTap;
        break;
    }

    this.removePoint(id);
  }

  public touchMove(x: number, y: number, id: number): void {
    this.onTouchEvent();

    const p = this.getPoint(id);
    if (!p)
      this.setState(TouchState.Invalid);

    if (TouchState.Invalid === this.state)
      return;

    if (!p!.update(x, y, this.viewport))
      return;

    switch (this.state) {
      case TouchState.Initial:
      case TouchState.TapPending:
        break;
      case TouchState.SecondDownOneUp:
      case TouchState.MovePending:
      case TouchState.FirstDown:
      case TouchState.SecondDown:
        this.setState(TouchState.Moving);
        break;
      case TouchState.SecondTapDown:
        this.setState(TouchState.Moving);
        break;
      case TouchState.Moving:
      case TouchState.InLongPress:
        break;
      case TouchState.InLongPressAwaitingTap:
        this.setState(TouchState.Invalid);
        break;
    }

    const newState = this.state;
    if (TouchState.InLongPress === newState || TouchState.Moving === newState)
      this.handleMove(this.touchPoints);
  }

  public tryLongPress(): boolean {
    if (TouchState.FirstDown !== this.state && this.touchPoints.length !== 1)
      return false;

    if ((Date.now() - this.touchPoints[0].previousTime) < TouchConstants.LONG_PRESS_LIMIT)
      return false;

    this.sendLongPressEvent(this.touchPoints, this.interpretingDataButtonAsTouch);
    return true;
  }

  public sendLongPressEvent(touchPoints: TouchPoint[], isFromMouse: boolean): void {
    const info = this.initGestureInfo(GestureId.LongPress, touchPoints[0].initialX, touchPoints[0].initialY, 0.0, touchPoints, false, isFromMouse);
    this.sendEvent(info);
  }

  public timerExpired(): void {
    this.queue.process(this.viewport);

    switch (this.state) {
      case TouchState.FirstDown:
        if (this.tryLongPress())
          this.setState(TouchState.InLongPress);
        break;
      case TouchState.TapPending:
        if (this.handleTaps(false))
          this.setState(TouchState.Initial);
        break;
    }
  }

  public handle2FingerTap(): void {
    const x = (this.firstTap1.x + this.firstTap2.x) / 2;
    const y = (this.firstTap1.y + this.firstTap2.y) / 2;
    this.sendTapEvent(x, y, TapEventType.TwoFingerSingleTap, this.touchPoints, this.interpretingDataButtonAsTouch);
  }

  public sendTapEvent(x: number, y: number, eventType: TapEventType, touchPoints: TouchPoint[], isFromMouse: boolean): void {
    let gestureId = GestureId.SingleTap;
    switch (eventType) {
      case TapEventType.OneFingerDoubleTap: gestureId = GestureId.DoubleTap; break;
      case TapEventType.TwoFingerSingleTap: gestureId = GestureId.TwoFingerTap; break;
    }

    const info = this.initGestureInfo(gestureId, x, y, 0.0, touchPoints, false, isFromMouse);
    this.sendEvent(info);
  }

  public handlePressAndTap(): void {
    this.sendPressAndTapEvent(this.touchPoints, this.interpretingDataButtonAsTouch);
  }

  public sendPressAndTapEvent(points: TouchPoint[], isFromMouse: boolean): void {
    const anchor = points[0];
    const tap = points[1];
    const tapDistance = tap.distance(anchor);

    const info = this.initGestureInfo(GestureId.PressAndTap, anchor.x, anchor.y, tapDistance, points, false, isFromMouse);
    this.sendEvent(info);
  }

  public handleTap(x: number, y: number, isDouble: boolean): void {
    this.sendTapEvent(x, y, isDouble ? TapEventType.OneFingerDoubleTap : TapEventType.OneFingerSingleTap, this.touchPoints, this.interpretingDataButtonAsTouch);
  }

  public handleTaps(allowDoubleTap: boolean): boolean {
    if (!allowDoubleTap) {
      const interval = Date.now() - this.tapUpTime;
      if (interval < TouchConstants.TAP_CONFIRM_SINGLE_LIMIT)
        return false;

      this.handleTap(this.firstTap1.x, this.firstTap1.y, false);
      return true;
    }

    const d = this.firstTap1.distance(this.secondTap1);
    if (TouchPoint.touchExceedsThreshold(d, TouchConstants.DOUBLE_TAP_DIST_THRESHOLD, this.viewport)) {
      this.handleTap(this.firstTap1.x, this.firstTap1.y, false);
      this.handleTap(this.secondTap1.x, this.secondTap1.y, false);
    } else {
      this.handleTap(this.firstTap1.x, this.firstTap1.y, true);
    }

    return true;
  }

  public handleMultiFingerMove(points: TouchPoint[]): boolean {
    if (points.length < 2)
      return false;

    if (GestureId.SingleFingerMove === this.endGestureId)
      this.sendEndGestureEvent(this.endGestureId, this.touchPoints[0].x, this.touchPoints[0].y, this.touchPoints, this.interpretingDataButtonAsTouch);

    const p0 = points[0];
    const p1 = points[1];

    const pinchDistance = p0.distance(p1);
    const cx = (p0.x + p1.x) / 2;
    const cy = (p0.y + p1.y) / 2;

    this.sendMultiFingerMoveEvent(cx, cy, pinchDistance, points, this.interpretingDataButtonAsTouch);

    this.endGestureId = GestureId.MultiFingerMove;
    return true;
  }

  public sendMultiFingerMoveEvent(centerX: number, centerY: number, distance: number, points: TouchPoint[], isFromMouse: boolean): void {
    const info = this.initGestureInfo(GestureId.MultiFingerMove, centerX, centerY, distance, points, false, isFromMouse);
    this.sendEvent(info);
  }

  public handleSingleFingerMove(points: TouchPoint[]): boolean {
    if (1 !== points.length)
      return false;

    if (GestureId.MultiFingerMove === this.endGestureId)
      this.sendEndGestureEvent(this.endGestureId, this.touchPoints[0].x, this.touchPoints[0].y, this.touchPoints, this.interpretingDataButtonAsTouch);

    if (0 === this.previousNumberTouches) {
      const startPoint = [this.firstDown];
      this.sendSingleFingerMoveEvent(startPoint, this.interpretingDataButtonAsTouch);
    }

    this.sendSingleFingerMoveEvent(points, this.interpretingDataButtonAsTouch);
    this.endGestureId = GestureId.SingleFingerMove;

    return true;
  }

  public sendSingleFingerMoveEvent(points: TouchPoint[], isFromMouse: boolean) {
    const info = this.initGestureInfo(GestureId.SingleFingerMove, points[0].x, points[0].y, 1.0, points, false, isFromMouse);
    this.sendEvent(info);
  }

  public handleMove(points: TouchPoint[]): boolean {
    return this.handleSingleFingerMove(points) || this.handleMultiFingerMove(points);
  }
}

type RemovalFunction = () => void;
export class EventController {

  private touchHandler?: TouchHandler;
  public element: HTMLElement;
  private removalFunctions: RemovalFunction[] = [];
  constructor(public vp: Viewport) {
    this.touchHandler = new TouchHandler(vp);
    this.registerListeners();
  }

  public isDestroyed() { return false; }

  public destroy() {
    this.unregisterListeners();
    this.touchHandler = undefined;
  }

  private unregisterListeners() {
    for (const func of this.removalFunctions) { func(); }
    this.removalFunctions.length = 0;
  }

  private registerListener(domType: string, element: HTMLElement, callback: EventListener) {
    const that = this;
    const listener = (e: Event) => { callback.call(that, e); };
    element.addEventListener(domType, listener, false);
    this.removalFunctions.push(() => { element.removeEventListener(domType, listener, false); });
  }

  private registerListeners() {
    const element = this.element;
    this.registerListener("mousedown", element, this.handleMouseDown as EventListener);
    this.registerListener("mouseup", element, this.handleMouseUp as EventListener);
    this.registerListener("mousemove", element, this.handleMouseMove as EventListener);
    this.registerListener("wheel", element, this.handleMouseWheel as EventListener);
    this.registerListener("touchstart", element, this.handleTouchStart as EventListener);
    this.registerListener("touchend", element, this.handleTouchEnd as EventListener);
    this.registerListener("touchmove", element, this.handleTouchMove as EventListener);
    this.registerListener("touchcancel", element, this.handleTouchCancel as EventListener);
  }

  private recordShiftKey() { toolAdmin.currentInputState.setKeyQualifier(ModifierKey.Shift, true); }
  private recordControlKey() { toolAdmin.currentInputState.setKeyQualifier(ModifierKey.Control, true); }
  private clearKeyboardModifiers() { toolAdmin.currentInputState.clearKeyQualifiers(); }

  private handleMiddleDown(pos: Point2d) { toolAdmin.onMiddleButtonDown(this.vp, pos); }
  private handleMiddleUp(pos: Point2d) { toolAdmin.onMiddleButtonUp(this.vp, pos); }
  private handleLeftDown(pos: Point2d) { toolAdmin.onDataButtonDown(this.vp, pos, InputSource.Mouse); }
  private handleLeftUp(pos: Point2d) { toolAdmin.onDataButtonUp(this.vp, pos, InputSource.Mouse); }
  private handleRightDown(pos: Point2d) { toolAdmin.onResetButtonDown(this.vp, pos); }
  private handleRightUp(pos: Point2d) { toolAdmin.onResetButtonUp(this.vp, pos); }

  private getMouseButtonHandler(button: MouseButton, isDown: boolean) {
    switch (button) {
      case MouseButton.LEFT: return isDown ? this.handleLeftDown : this.handleLeftUp;
      case MouseButton.MIDDLE: return isDown ? this.handleMiddleDown : this.handleMiddleUp;
      case MouseButton.RIGHT: return isDown ? this.handleRightDown : this.handleRightUp;
      default: return undefined;
    }
  }

  private recordKeyboardModifiers(ev: MouseEvent) {
    this.clearKeyboardModifiers();
    if (ev.shiftKey)
      this.recordShiftKey();

    if (ev.ctrlKey)
      this.recordControlKey();
  }

  private getPosition(ev: Touch | MouseEvent, result: Point2d) {
    const element = this.element as any;
    if (element === document) {
      result.x = ev.clientX;
      result.y = ev.clientY;
      return result;
    }

    const rect = element.getBoundingClientRect();
    result.x = ev.clientX - rect.left;
    result.y = ev.clientY - rect.top;
    return result;
  }

  private static scratchMousePos = new Point2d();
  private handleMouseUpDown(ev: MouseEvent, isDown: boolean) {
    const handler = this.getMouseButtonHandler(ev.button, isDown);
    if (!handler)
      return;

    this.recordKeyboardModifiers(ev);
    const pos = this.getPosition(ev, EventController.scratchMousePos);

    handler.call(this, pos);
    ev.preventDefault();
  }

  private handleMouseDown(ev: MouseEvent) { this.handleMouseUpDown(ev, true); }
  private handleMouseUp(ev: MouseEvent) { this.handleMouseUpDown(ev, false); }

  private handleMouseMove(ev: MouseEvent) {
    this.recordKeyboardModifiers(ev);
    const pos = this.getPosition(ev, EventController.scratchMousePos);
    toolAdmin.onMouseMotion(this.vp, pos, InputSource.Mouse);
    ev.preventDefault();
  }

  private handleMouseWheel(ev: WheelEvent) {
    this.recordKeyboardModifiers(ev);

    let delta;
    const deltaMode = ev.deltaMode;
    if (deltaMode === ev.DOM_DELTA_PIXEL)
      delta = -ev.deltaY;
    else if (deltaMode === ev.DOM_DELTA_LINE)
      delta = -ev.deltaY * 40;
    else
      delta = -ev.deltaY * 120;

    if (!delta)
      return;

    toolAdmin.onWheel(this.vp, delta, toolAdmin.currentInputState.lastMotion);
    ev.preventDefault();
  }

  private processTouches(ev: TouchEvent, func: (handler: TouchHandler, id: number, num: number, x: number, y: number) => void) {
    const touches = ev.changedTouches;
    const numFingers = ev.touches.length;

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < touches.length; ++i) {
      const touch = touches[i];
      const id = touch.identifier;
      const pos = this.getPosition(touch, EventController.scratchMousePos);
      func(this.touchHandler!, id, numFingers, pos.x, pos.y);
    }

    ev.preventDefault();
  }

  private handleTouchStart(ev: TouchEvent) {
    this.processTouches(ev, (handler: TouchHandler, id: number, num: number, x: number, y: number) => { handler.touchDown(x, y, id, num, false); });
  }

  private handleTouchEnd(ev: TouchEvent) {
    this.processTouches(ev, (handler: TouchHandler, id: number, _num: number, _x: number, _y: number) => { handler.touchUp(id); });
  }

  private handleTouchMove(ev: TouchEvent) {
    this.processTouches(ev, (handler: TouchHandler, id: number, _num: number, x: number, y: number) => { handler.touchMove(x, y, id); });
  }

  private handleTouchCancel(_ev: TouchEvent) {
    this.touchHandler!.touchCanceled();
  }

}
