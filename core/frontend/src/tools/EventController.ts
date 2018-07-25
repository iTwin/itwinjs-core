/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Viewport } from "../Viewport";
import { GestureId, GestureInfo } from "./Tool";
import { Point2d } from "@bentley/geometry-core";
import { IModelApp } from "../IModelApp";

// tslint:disable:no-console

/** @hidden */
const enum TouchConstants {
  TAP_LIMIT = 800,
  TAP_CONFIRM_SINGLE_LIMIT = 200,
  TAP_INVALID_UP_TIME = 0xffffffff,
  LONG_PRESS_LIMIT = 500,
  INITIAL_MOVE_THRESHOLD = 0.09,
  DOUBLE_TAP_DIST_THRESHOLD = 0.25,
  TICK = 16 / 1000,  // 16ms
}

/** @hidden */
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

/** @hidden */
const enum TapEventType {
  OneFingerSingleTap = 0,
  OneFingerDoubleTap = 1,
  TwoFingerSingleTap = 2,
}

/** @hidden */
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

type RemovalFunction = () => void;

/**
 * An EventController maps user input events from the canvas of a Viewport to the ToolAdmin so that tools can process them.
 * Viewports are assigned an EventController when they are registered with ViewManager.addViewport, and they are destroyed with
 * ViewManager.dropViewport.
 */
export class EventController {
  private readonly touchPoints: TouchPoint[] = [];
  private readonly touchQueue: GestureInfo[] = [];
  private previousNumberTouches = 0;
  private readonly firstDown = new TouchPoint();
  private readonly firstTap1 = new TouchPoint();  // 1- and 2-finger taps
  private readonly firstTap2 = new TouchPoint();  // 2-finger taps only
  private readonly secondTap1 = new TouchPoint(); // 1- and 2-finger taps
  public lastTouchEventTime = 0;
  private touchTimer = Date.now();
  private tapDownTime = 0;
  private tapUpTime = 0;
  private state = TouchState.Invalid;
  private interpretingDataButtonAsTouch = false;
  private endGestureId = GestureId.None;
  private readonly removals: RemovalFunction[] = [];

  constructor(public vp: Viewport) {
    this.registerListeners();
    this.initializeTouches();
  }

  public destroy() {
    this.removals.forEach((remove) => remove());
    this.removals.length = 0;
  }

  private registerListener(domType: string, element: HTMLElement, preventDefault: boolean = true) {
    const listener = (ev: Event) => {
      if (preventDefault)
        ev.preventDefault();
      IModelApp.toolAdmin.addEvent(ev, this.vp);
    };
    element.addEventListener(domType, listener, false);
    this.removals.push(() => { element.removeEventListener(domType, listener, false); });
  }

  private registerListeners() {
    const element = this.vp.canvas;
    if (!element)
      return;

    this.registerListener("mousedown", element);
    this.registerListener("mouseup", element);
    this.registerListener("mousemove", element);
    this.registerListener("mouseenter", element);
    this.registerListener("mouseleave", element);
    this.registerListener("wheel", element);
    // this.registerListener("touchstart", element, this.handleTouchStart as EventListener);
    // this.registerListener("touchend", element, this.handleTouchEnd as EventListener);
    // this.registerListener("touchmove", element, this.handleTouchMove as EventListener);
    // this.registerListener("touchcancel", element, this.handleTouchCancel as EventListener);

    element.oncontextmenu = () => false;
    element.onselectstart = () => false;
  }

  private initializeTouches(): void {
    this.tapDownTime = 0;
    this.tapUpTime = 0;
    this.touchPoints.length = 0;
    this.state = TouchState.Initial;
    this.interpretingDataButtonAsTouch = false;
    this.endGestureId = GestureId.None;
  }

  private pushTouch(info: GestureInfo): void {
    // Try to replace the last entry in the queue
    if (this.touchQueue.length === 0 || !this.tryReplaceTouch(this.touchQueue[this.touchQueue.length - 1], info))
      this.touchQueue.push(info.clone());
  }

  private tryReplaceTouch(existing: GestureInfo, replacement: GestureInfo): boolean {
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

  private processTouchEvent(vp: Viewport): void {
    const len = this.touchQueue.length;
    if (len > 0) {
      for (let i = 0; i < len; i++)
        this.dispatchTouchEvent(this.touchQueue[i], vp);

      this.touchQueue.length = 0;
    }
  }

  private dispatchTouchEvent(info: GestureInfo, vp: Viewport): void {
    if (info.isEndGesture) {
      IModelApp.toolAdmin.onEndGesture(vp, info);
      return;
    }

    switch (info.gestureId) {
      case GestureId.MultiFingerMove: return IModelApp.toolAdmin.onMultiFingerMove(vp, info);
      case GestureId.SingleFingerMove: return IModelApp.toolAdmin.onSingleFingerMove(vp, info);
      case GestureId.TwoFingerTap: return IModelApp.toolAdmin.onTwoFingerTap(vp, info);
      case GestureId.PressAndTap: return IModelApp.toolAdmin.onPressAndTap(vp, info);
      //      case GestureId.SingleTap: return IModelApp.toolAdmin.onSingleTap(vp, info);
      case GestureId.DoubleTap: return IModelApp.toolAdmin.onDoubleTap(vp, info);
      case GestureId.LongPress: return IModelApp.toolAdmin.onLongPress(vp, info);
    }
  }

  private getPreviousNumberTouches(update: boolean): number {
    const val = this.previousNumberTouches;
    if (update)
      this.previousNumberTouches = this.touchPoints.length;
    return val;
  }

  private setTouchState(newState: TouchState): void {
    //  reportStateTransition(newState, this.state);
    if (TouchState.Invalid === newState) {
      if (0 !== this.endGestureId && (0 !== this.touchPoints.length || 0 !== this.previousNumberTouches))
        this.sendEndGestureEvent(this.endGestureId, this.touchPoints[0].x, this.touchPoints[0].y, this.touchPoints, this.interpretingDataButtonAsTouch);

      this.previousNumberTouches = 0;
    }

    if (TouchState.Initial === newState || TouchState.Invalid === newState)
      this.initializeTouches();

    this.state = newState;
  }

  private initGestureInfo(gestureId: GestureId, centerX: number, centerY: number, distance: number, points: TouchPoint[], isEnding: boolean, isFromMouse: boolean): GestureInfo {
    const info = new GestureInfo();
    info.init(gestureId, centerX, centerY, distance, points, isEnding, isFromMouse, this.getPreviousNumberTouches(true));
    return info;
  }

  private sendGestureEvent(info: GestureInfo) { this.pushTouch(info); }

  private sendEndGestureEvent(gestureId: GestureId, x: number, y: number, points: TouchPoint[], isFromMouse: boolean) {
    const info = this.initGestureInfo(gestureId, x, y, 0.0, points, true, isFromMouse);
    this.sendGestureEvent(info);
  }

  public touchCanceled(): void { this.setTouchState(TouchState.Invalid); }
  private onTouchEvent(): void { this.lastTouchEventTime = Date.now(); }

  private getTouchPoint(id: number): TouchPoint | undefined {
    for (const cur of this.touchPoints) {
      if (cur.pointId === id)
        return cur;
    }

    return undefined;
  }

  private removeTouchPoint(id: number): boolean {
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
      this.setTouchState(TouchState.Invalid);
    }

    if (this.state === TouchState.Invalid)
      this.setTouchState(TouchState.Initial);

    if (interpretingDataButtonAsTouch)
      this.interpretingDataButtonAsTouch = true;

    const eventTime = Date.now();
    this.touchPoints.push(new TouchPoint(x, y, id, eventTime));
    if (this.touchPoints.length === 1)
      this.firstDown.copyFrom(this.touchPoints[0]);

    switch (this.state) {
      case TouchState.Initial:
        this.previousNumberTouches = 0;
        this.tapDownTime = eventTime;
        this.tapUpTime = TouchConstants.TAP_INVALID_UP_TIME;
        this.setTouchState(TouchState.FirstDown);
        break;
      case TouchState.FirstDown:
        this.setTouchState(TouchState.SecondDown);
        break;
      case TouchState.SecondDown:
        this.setTouchState(TouchState.MovePending);
        break;
      case TouchState.TapPending:
        this.setTouchState(TouchState.SecondTapDown);
        break;
      case TouchState.SecondTapDown:
        this.setTouchState(TouchState.Invalid);
        break;
      case TouchState.SecondDownOneUp:
        this.setTouchState(TouchState.Moving);
        break;
      case TouchState.Moving:
        break;  // no state changes once we start moving.
      case TouchState.InLongPress:
        this.firstTap1.copyFrom(this.touchPoints[0]);
        this.setTouchState(TouchState.InLongPressAwaitingTap);
        break;
      case TouchState.InLongPressAwaitingTap:
        this.setTouchState(TouchState.Invalid);
        break;
    }
  }

  public touchUp(id: number): void {
    this.onTouchEvent();
    const interpretingDataButtonAsTouch = this.interpretingDataButtonAsTouch;

    const upPoint = this.getTouchPoint(id);
    if (!upPoint)
      this.setTouchState(TouchState.Invalid);

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
          this.setTouchState(TouchState.TapPending);
          this.tapUpTime = eventTime;
          this.firstTap1.copyFrom(upPoint!);
        } else {
          this.setTouchState(TouchState.Initial);
        }
        break;
      case TouchState.SecondTapDown:
        const interval2 = eventTime - this.tapDownTime;
        if (interval2 < TouchConstants.TAP_LIMIT) {
          this.tapUpTime = eventTime;
          this.secondTap1.copyFrom(upPoint!);
          this.handleTaps(true);
        }

        this.setTouchState(TouchState.Initial);
        break;
      case TouchState.SecondDown:
        const interval3 = eventTime - this.tapDownTime;
        if (interval3 > TouchConstants.TAP_LIMIT) {
          this.setTouchState(TouchState.Invalid);
          break;
        }

        this.firstTap1.copyFrom(upPoint!);
        this.setTouchState(TouchState.SecondDownOneUp);
        break;
      case TouchState.SecondDownOneUp:
        const interval = eventTime - this.tapDownTime;
        if (interval > TouchConstants.TAP_LIMIT) {
          this.setTouchState(TouchState.Invalid);
          break;
        }

        this.firstTap2.copyFrom(upPoint!);
        this.handle2FingerTap();
        this.setTouchState(TouchState.Initial);
        break;
      case TouchState.MovePending:
        if (this.touchPoints.length === 1)
          this.setTouchState(TouchState.Initial);
        break;
      case TouchState.Moving:
        if (this.touchPoints.length === 1) {
          const endGestureId1 = this.endGestureId;
          const touchPoint1 = this.touchPoints[0];
          this.setTouchState(TouchState.Initial);
          this.sendEndGestureEvent(endGestureId1, touchPoint1.x, touchPoint1.y, this.touchPoints, interpretingDataButtonAsTouch);
        }
        break;
      case TouchState.InLongPress:
        const endGestureId = (GestureId.PressAndTap !== this.endGestureId) ? GestureId.LongPress : this.endGestureId;
        const touchPoint = this.touchPoints[0];
        this.setTouchState(TouchState.Initial);
        this.sendEndGestureEvent(endGestureId, touchPoint.x, touchPoint.y, this.touchPoints, interpretingDataButtonAsTouch);
        break;
      case TouchState.InLongPressAwaitingTap:
        if (upPoint!.pointId === this.firstTap1.pointId) {
          this.setTouchState(TouchState.Invalid);
          break;
        }

        this.handlePressAndTap();
        this.setTouchState(TouchState.InLongPress);
        this.endGestureId = GestureId.PressAndTap;
        break;
    }

    this.removeTouchPoint(id);
  }

  public touchMove(x: number, y: number, id: number): void {
    this.onTouchEvent();

    const p = this.getTouchPoint(id);
    if (!p)
      this.setTouchState(TouchState.Invalid);

    if (TouchState.Invalid === this.state)
      return;

    if (!p!.update(x, y, this.vp))
      return;

    switch (this.state) {
      case TouchState.Initial:
      case TouchState.TapPending:
        break;
      case TouchState.SecondDownOneUp:
      case TouchState.MovePending:
      case TouchState.FirstDown:
      case TouchState.SecondDown:
        this.setTouchState(TouchState.Moving);
        break;
      case TouchState.SecondTapDown:
        this.setTouchState(TouchState.Moving);
        break;
      case TouchState.Moving:
      case TouchState.InLongPress:
        break;
      case TouchState.InLongPressAwaitingTap:
        this.setTouchState(TouchState.Invalid);
        break;
    }

    const newState = this.state;
    if (TouchState.InLongPress === newState || TouchState.Moving === newState)
      this.handleMove(this.touchPoints);
  }

  private tryLongPress(): boolean {
    if (TouchState.FirstDown !== this.state && this.touchPoints.length !== 1)
      return false;

    if ((Date.now() - this.touchPoints[0].previousTime) < TouchConstants.LONG_PRESS_LIMIT)
      return false;

    this.sendLongPressEvent(this.touchPoints, this.interpretingDataButtonAsTouch);
    return true;
  }

  private sendLongPressEvent(touchPoints: TouchPoint[], isFromMouse: boolean): void {
    const info = this.initGestureInfo(GestureId.LongPress, touchPoints[0].initialX, touchPoints[0].initialY, 0.0, touchPoints, false, isFromMouse);
    this.sendGestureEvent(info);
  }

  public updateTouches() {
    const now = Date.now();
    if ((now - this.touchTimer) >= TouchConstants.TICK) {
      this.touchTimer = now;
      this.touchTimerExpired();
    }
  }

  private touchTimerExpired(): void {
    this.processTouchEvent(this.vp);

    switch (this.state) {
      case TouchState.FirstDown:
        if (this.tryLongPress())
          this.setTouchState(TouchState.InLongPress);
        break;
      case TouchState.TapPending:
        if (this.handleTaps(false))
          this.setTouchState(TouchState.Initial);
        break;
    }
  }

  private handle2FingerTap(): void {
    const x = (this.firstTap1.x + this.firstTap2.x) / 2;
    const y = (this.firstTap1.y + this.firstTap2.y) / 2;
    this.sendTapEvent(x, y, TapEventType.TwoFingerSingleTap, this.touchPoints, this.interpretingDataButtonAsTouch);
  }

  private sendTapEvent(x: number, y: number, eventType: TapEventType, touchPoints: TouchPoint[], isFromMouse: boolean): void {
    let gestureId = GestureId.SingleTap;
    switch (eventType) {
      case TapEventType.OneFingerDoubleTap: gestureId = GestureId.DoubleTap; break;
      case TapEventType.TwoFingerSingleTap: gestureId = GestureId.TwoFingerTap; break;
    }

    const info = this.initGestureInfo(gestureId, x, y, 0.0, touchPoints, false, isFromMouse);
    this.sendGestureEvent(info);
  }

  private handlePressAndTap(): void { this.sendPressAndTapEvent(this.touchPoints, this.interpretingDataButtonAsTouch); }

  private sendPressAndTapEvent(points: TouchPoint[], isFromMouse: boolean): void {
    const anchor = points[0];
    const tap = points[1];
    const tapDistance = tap.distance(anchor);

    const info = this.initGestureInfo(GestureId.PressAndTap, anchor.x, anchor.y, tapDistance, points, false, isFromMouse);
    this.sendGestureEvent(info);
  }

  private handleTap(x: number, y: number, isDouble: boolean): void {
    this.sendTapEvent(x, y, isDouble ? TapEventType.OneFingerDoubleTap : TapEventType.OneFingerSingleTap, this.touchPoints, this.interpretingDataButtonAsTouch);
  }

  private handleTaps(allowDoubleTap: boolean): boolean {
    if (!allowDoubleTap) {
      const interval = Date.now() - this.tapUpTime;
      if (interval < TouchConstants.TAP_CONFIRM_SINGLE_LIMIT)
        return false;

      this.handleTap(this.firstTap1.x, this.firstTap1.y, false);
      return true;
    }

    const d = this.firstTap1.distance(this.secondTap1);
    if (TouchPoint.touchExceedsThreshold(d, TouchConstants.DOUBLE_TAP_DIST_THRESHOLD, this.vp)) {
      this.handleTap(this.firstTap1.x, this.firstTap1.y, false);
      this.handleTap(this.secondTap1.x, this.secondTap1.y, false);
    } else {
      this.handleTap(this.firstTap1.x, this.firstTap1.y, true);
    }

    return true;
  }

  private handleMultiFingerMove(points: TouchPoint[]): boolean {
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

  private sendMultiFingerMoveEvent(centerX: number, centerY: number, distance: number, points: TouchPoint[], isFromMouse: boolean): void {
    const info = this.initGestureInfo(GestureId.MultiFingerMove, centerX, centerY, distance, points, false, isFromMouse);
    this.sendGestureEvent(info);
  }

  private handleSingleFingerMove(points: TouchPoint[]): boolean {
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

  private sendSingleFingerMoveEvent(points: TouchPoint[], isFromMouse: boolean) {
    const info = this.initGestureInfo(GestureId.SingleFingerMove, points[0].x, points[0].y, 1.0, points, false, isFromMouse);
    this.sendGestureEvent(info);
  }

  private handleMove(points: TouchPoint[]): boolean {
    return this.handleSingleFingerMove(points) || this.handleMultiFingerMove(points);
  }

  public processTouches(ev: TouchEvent, _func: (id: number, num: number, x: number, y: number) => void) {
    // const touches = ev.changedTouches;
    // const numFingers = touches.length;

    // // tslint:disable-next-line:prefer-for-of
    // for (let i = 0; i < touches.length; ++i) {
    //   const touch = touches[i];
    //   const pos = this.getPosition(touch);
    //   func(touch.identifier, numFingers, pos.x, pos.y);
    // }

    ev.preventDefault();
  }

  // private handleTouchStart(ev: TouchEvent) { this.processTouches(ev, (id: number, num: number, x: number, y: number) => this.touchDown(x, y, id, num, false)); }
  // private handleTouchEnd(ev: TouchEvent) { this.processTouches(ev, (id: number, _num: number, _x: number, _y: number) => this.touchUp(id)); }
  // private handleTouchMove(ev: TouchEvent) { this.processTouches(ev, (id: number, _num: number, x: number, y: number) => this.touchMove(x, y, id)); }
  // private handleTouchCancel(_ev: TouchEvent) { this.touchCanceled(); }
}
