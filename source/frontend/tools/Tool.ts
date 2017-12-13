/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Point2d } from "@bentley/geometry-core/lib/PointVector";
import { Viewport } from "../Viewport";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";

export const enum BeButton {
  Data = 0,
  Reset = 1,
  Middle = 2,
}

export enum BeCursor {
  Default = "default",
  CrossHair = "crosshair",
  OpenHand = "grab",
  ClosedHand = "grabbing",
  Rotate = "move",
  Arrow = "default",
  NotAllowed = "not-allowed",
  Text = "text",
  Busy = "wait",
}

export const enum GestureId {
  None = 0,
  MultiFingerMove = 1, // two or more fingers dragging
  SingleFingerMove = 2, // a single finger dragging
  TwoFingerTap = 3, // tap with two fingers
  PressAndTap = 4, // long press followed by a tap
  SingleTap = 5, // One finger down and up; implies no LongPress active
  DoubleTap = 6, // One finger down and up; implies no LongPress active
  LongPress = 7, // One finger held down for more than some threshold
}

export const enum InputSource {
  Unknown = 0, // source not defined
  Mouse = 1,   // mouse or other pointing device
  Touch = 2,    // touch-sensitive device e.g. a touch screen
}

/** The "source" that generated this event. */
export const enum CoordSource {
  User = 0,    // event was created by an action from the user
  Precision = 1,    // event was created by a program or by a precision keyin
  TentativePoint = 2,  // event was created by a tentative point
  ElemSnap = 3,    // event was created by snapping to an element
}

export const enum BeModifierKey {
  None = 0,
  Control = 1 << 0,
  Shift = 1 << 2,
  Alt = 1 << 3,
}

export const enum BeVirtualKey {
  Shift,
  Control,
  Alt,
  Backspace,
  Tab,
  Return,
  Escape,
  Space,
  PageUp,
  PageDown,
  End,
  Home,
  Left,
  Up,
  Right,
  Down,
  Insert,
  Delete,
  Key0,
  Key1,
  Key2,
  Key3,
  Key4,
  Key5,
  Key6,
  Key7,
  Key8,
  Key9,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
  I,
  J,
  K,
  L,
  M,
  N,
  O,
  P,
  Q,
  R,
  S,
  T,
  U,
  V,
  W,
  X,
  Y,
  Z,
  NumKey0,
  NumKey1,
  NumKey2,
  NumKey3,
  NumKey4,
  NumKey5,
  NumKey6,
  NumKey7,
  NumKey8,
  NumKey9,
  Multiply,
  Add,
  Separator,
  Subtract,
  Decimal,
  Divide,
  Comma,
  Period,
  F1,
  F2,
  F3,
  F4,
  F5,
  F6,
  F7,
  F8,
  F9,
  F10,
  F11,
  F12,
}

export class BeButtonState {
  private _downUorPt: Point3d = new Point3d();
  private _downRawPt: Point3d = new Point3d();
  public downTime: number = 0;
  public isDown: boolean = false;
  public isDoubleClick: boolean = false;
  public isDragging: boolean = false;
  public inputSource: InputSource = InputSource.Unknown;

  public get downRawPt() { return this._downRawPt; }
  public set downRawPt(pt: Point3d) { this._downRawPt.setFrom(pt); }
  public get downUorPt() { return this._downUorPt; }
  public set downUorPt(pt: Point3d) { this._downUorPt.setFrom(pt); }

  public init(downUorPt: Point3d, downRawPt: Point3d, downTime: number, isDown: boolean, isDoubleClick: boolean, isDragging: boolean, source: InputSource) {
    this.downUorPt = downUorPt;
    this.downRawPt = downRawPt;
    this.downTime = downTime;
    this.isDown = isDown;
    this.isDoubleClick = isDoubleClick;
    this.isDragging = isDragging;
    this.inputSource = source;
  }
}

export class BeButtonEvent {
  private _point: Point3d = new Point3d();
  private _rawPoint: Point3d = new Point3d();
  private _viewPoint: Point3d = new Point3d();
  public viewport?: Viewport;
  public coordsFrom: CoordSource;   // how were the coordinate values in point generated?
  public keyModifiers: BeModifierKey;
  public isDoubleClick: boolean;
  public isDown: boolean;
  public button: BeButton;
  public inputSource: InputSource;
  public actualInputSource: InputSource;

  public get point() { return this._point; }
  public set point(pt: Point3d) { this._point.setFrom(pt); }
  public get rawPoint() { return this._rawPoint; }
  public set rawPoint(pt: Point3d) { this._rawPoint.setFrom(pt); }
  public get viewPoint() { return this._viewPoint; }
  public set viewPoint(pt: Point3d) { this._viewPoint.setFrom(pt); }

  public initEvent(point: Point3d, rawPoint: Point3d, viewPt: Point3d, vp: Viewport, from: CoordSource, keyModifiers: BeModifierKey, button = BeButton.Data, isDown = true, doubleClick = false, source = InputSource.Unknown) {
    this.point = point;
    this.rawPoint = rawPoint;
    this.viewPoint = viewPt;
    this.viewport = vp;
    this.coordsFrom = from;
    this.keyModifiers = keyModifiers;
    this.isDoubleClick = doubleClick;
    this.isDown = isDown;
    this.button = button;
    this.inputSource = source;
    this.actualInputSource = source;
  }

  public getDisplayPoint(): Point2d { return new Point2d(this._viewPoint.x, this._viewPoint.y); }
  public get isControlKey() { return 0 !== (this.keyModifiers & BeModifierKey.Control); }
  public get isShiftKey() { return 0 !== (this.keyModifiers & BeModifierKey.Shift); }
  public get isAltKey() { return 0 !== (this.keyModifiers & BeModifierKey.Alt); }
  public reset() { this.viewport = undefined; }

  public copyFrom(src: BeButtonEvent) {
    this.point = src.point;
    this.rawPoint = src.rawPoint;
    this.viewPoint = src.viewPoint;
    this.viewport = src.viewport;
    this.coordsFrom = src.coordsFrom;
    this.keyModifiers = src.keyModifiers;
    this.isDoubleClick = src.isDoubleClick;
    this.isDown = src.isDown;
    this.button = src.button;
    this.inputSource = src.inputSource;
    this.actualInputSource = src.actualInputSource;
  }
  public clone(result?: BeButtonEvent): BeButtonEvent {
    result = result ? result : new BeButtonEvent();
    result.copyFrom(this);
    return result;
  }
}

/** Describes a "gesture" input originating from a touch-input device. */
export class GestureInfo {
  public gestureId: GestureId;
  public numberTouches: number;
  public previousNumberTouches: number;    // Only meaningful for GestureId::SingleFingerMove and GestureId::MultiFingerMove
  public touches: Point2d[] = [new Point2d(), new Point2d(), new Point2d()];
  public ptsLocation: Point2d = new Point2d();    // Location of centroid
  public distance: number;                 // Only meaningful on motion with multiple touches
  public isEndGesture: boolean;
  public isFromMouse: boolean;

  public getViewPoint(vp: Viewport) {
    const screenRect = vp.viewRect;
    return new Point3d(this.ptsLocation.x - screenRect.low.x, this.ptsLocation.y - screenRect.low.y, 0.0);
  }

  public init(gestureId: GestureId, centerX: number, centerY: number, distance: number, touchPoints: Point2d[], isEnding: boolean, isFromMouse: boolean, prevNumTouches: number) {
    this.gestureId = gestureId;
    this.numberTouches = Math.min(touchPoints.length, 3);
    this.previousNumberTouches = prevNumTouches;
    this.isEndGesture = isEnding;
    this.isFromMouse = isFromMouse;

    this.ptsLocation.x = Math.floor(centerX);
    this.ptsLocation.y = Math.floor(centerY);
    this.distance = distance;

    for (let i = 0; i < this.numberTouches; ++i) {
      this.touches[i].x = Math.floor(touchPoints[i].x);
      this.touches[i].y = Math.floor(touchPoints[i].y);
    }
  }

  public copyFrom(src: GestureInfo) {
    this.gestureId = src.gestureId;
    this.numberTouches = src.numberTouches;
    this.previousNumberTouches = src.previousNumberTouches;
    this.isEndGesture = src.isEndGesture;

    this.ptsLocation.x = src.ptsLocation.x;
    this.ptsLocation.y = src.ptsLocation.y;
    this.distance = src.distance;

    for (let i = 0; i < this.numberTouches; ++i) {
      this.touches[i].x = src.touches[i].x;
      this.touches[i].y = src.touches[i].y;
    }

    this.isFromMouse = src.isFromMouse;
  }
  public clone(result?: GestureInfo) {
    result = result ? result : new GestureInfo();
    result.copyFrom(this);
    return result;
  }
}

/** Specialization of ButtonEvent describing a gesture event, typically originating from touch input. */
export class BeGestureEvent extends BeButtonEvent {
  public gestureInfo?: GestureInfo;
  public copyFrom(src: BeGestureEvent) {
    super.copyFrom(src);
    this.gestureInfo = src.gestureInfo;
  }
  public clone(result?: BeGestureEvent): BeGestureEvent {
    result = result ? result : new BeGestureEvent();
    result.copyFrom(this);
    return result;
  }
}

/** Information about movement of the "wheel". */
export class BeWheelEvent extends BeButtonEvent {
  public constructor(public wheelDelta: number = 0) { super(); }
  public copyFrom(src: BeWheelEvent): void {
    super.copyFrom(src);
    this.wheelDelta = src.wheelDelta;
  }
  public clone(result?: BeWheelEvent): BeWheelEvent {
    result = result ? result : new BeWheelEvent();
    result.copyFrom(this);
    return result;
  }
}

/**
 * Base Tool class for handling user input events from Viewports.
 * Applications should create subclasses of ViewTool or PrimitiveTool and not Tool directly.
 */
export abstract class Tool {
  // tslint:disable:no-empty
  public abstract get toolId(): string;
  public abstract installToolImplementation(): BentleyStatus;
  public installTool(): BentleyStatus { return this.installToolImplementation(); }
  /** Override to execute additional logic after tool becomes active */
  public onPostInstall(): void { }
  /** Override to execute additional logic when tool is installed. Return false to prevent this tool from becoming active */
  public onInstall(): boolean { return true; }
  /** Implement to handle data-button-down events */
  public abstract onDataButtonDown(ev: BeButtonEvent): void;
  /** Invoked when the data button is released. */
  public onDataButtonUp(_ev: BeButtonEvent): boolean { return false; }
  /** Invoked when the reset button is pressed. */
  public onResetButtonDown(_ev: BeButtonEvent): boolean { return false; }
  /** Invoked when the reset button is released. */
  public onResetButtonUp(_ev: BeButtonEvent): boolean { return false; }
  /** Invoked when the middle mouse button is pressed. */
  public onMiddleButtonDown(_ev: BeButtonEvent): boolean { return false; }
  /** Invoked when the middle mouse button is released. */
  public onMiddleButtonUp(_ev: BeButtonEvent): boolean { return false; }
  /** Invoked when the cursor is moving */
  public onModelMotion(_ev: BeButtonEvent): void { }
  /** Invoked when the cursor is not moving */
  public onModelNoMotion(_ev: BeButtonEvent): void { }
  /** Invoked when the cursor was previously moving, and has stopped moving. */
  public onModelMotionStopped(_ev: BeButtonEvent): void { }
  /** Invoked when the cursor begins moving while a button is depressed */
  public onModelStartDrag(_ev: BeButtonEvent): boolean { return false; }
  /** Invoked when the cursor stops moving while a button is depressed */
  public onModelEndDrag(ev: BeButtonEvent) { return this.onDataButtonDown(ev); }
  /** Invoked when the mouse wheel moves. */
  public onMouseWheel(_ev: BeWheelEvent): boolean { return false; }
  /** Implemented by direct subclasses to handle when the tool becomes no longer active. Generally not overridden by other subclasses */
  public abstract exitTool(): void;
  /** Invoked when the tool becomes no longer active, to perform additional cleanup logic */
  public onCleanup() { }
  /** Invoked when the dimensions of the tool's viewport change */
  public onViewportResized() { }
  /** Invoked to allow a tool to update any view decorations it may have created */
  public updateDynamics(_ev: BeButtonEvent) { }
  public onTouchMotionPaused(): boolean { return false; }
  public onEndGesture(_ev: BeGestureEvent): boolean { return false; }
  public onSingleFingerMove(_ev: BeGestureEvent): boolean { return false; }
  public onMultiFingerMove(_ev: BeGestureEvent): boolean { return false; }
  public onTwoFingerTap(_ev: BeGestureEvent): boolean { return false; }
  public onPressAndTap(_ev: BeGestureEvent): boolean { return false; }
  public onSingleTap(_ev: BeGestureEvent): boolean { return false; }
  public onDoubleTap(_ev: BeGestureEvent): boolean { return false; }
  public onLongPress(_ev: BeGestureEvent): boolean { return false; }
  public isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; }
  public isCompatibleViewport(vp: Viewport, _isSelectedViewChange: boolean): boolean { return !!vp; }

  /** Called when Control, Shift, or Alt qualifier keys are pressed or released.
   * @param _wentDown up or down key event
   * @param _key One of VirtualKey.Control, VirtualKey.Shift, or VirtualKey.Alt
   * @return true to refresh view decorations or update dynamics.
   */
  public onModifierKeyTransition(_wentDown: boolean, _key: BeModifierKey): boolean { return false; }

  /** Called when  keys are pressed or released.
   * @param wentDown up or down key event
   * @param key One of VirtualKey enum values
   * @param shiftIsDown the shift key is down
   * @param ctrlIsDown  the control key is down
   * @return true to prevent further processing of this event
   * @note In case of Shift, Control and Alt key, onModifierKeyTransition is used.
   */
  public onKeyTransition(_wentDown: boolean, _key: BeVirtualKey, _shiftIsDown: boolean, _ctrlIsDown: boolean): boolean { return false; }
}
