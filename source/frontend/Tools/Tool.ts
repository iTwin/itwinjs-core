/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Point2d } from "@bentley/geometry-core/lib/PointVector";
import { Viewport } from "../Viewport";

export const enum Button {
  Data = 0,
  Reset = 1,
  Middle = 2,
}

export enum Cursor {
  Default = "default",
  CrossHair = "crosshair",
  OpenHand = "grab",
  ClosedHand = "grabbing",
  Rotate = "move",
  Arrow = "default",
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

export const enum InputEventModifiers {
  None = 0,
  Control = 1 << 0,
  Shift = 1 << 2,
}

export class ButtonState {
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

export class ButtonEvent {
  private _point: Point3d = new Point3d();
  private _rawPoint: Point3d = new Point3d();
  private _viewPoint: Point3d = new Point3d();
  public viewport?: Viewport;
  public coordsFrom: CoordSource;   // how were the coordinate values in point generated?
  public keyModifiers: InputEventModifiers;
  public isDoubleClick: boolean;
  public isDown: boolean;
  public button: Button;
  public inputSource: InputSource;
  public actualInputSource: InputSource;

  public get point() { return this._point; }
  public set point(pt: Point3d) { this._point.setFrom(pt); }
  public get rawPoint() { return this._rawPoint; }
  public set rawPoint(pt: Point3d) { this._rawPoint.setFrom(pt); }
  public get viewPoint() { return this._viewPoint; }
  public set viewPoint(pt: Point3d) { this._viewPoint.setFrom(pt); }

  public initEvent(point: Point3d, rawPoint: Point3d, viewPt: Point3d, vp: Viewport, from: CoordSource, keyModifiers: InputEventModifiers, button = Button.Data, isDown = true, doubleClick = false, source = InputSource.Unknown) {
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
  public get isControlKey() { return 0 !== (this.keyModifiers & InputEventModifiers.Control); }
  public get isShiftKey() { return 0 !== (this.keyModifiers & InputEventModifiers.Shift); }
  public reset() { this.viewport = undefined; }
}

/** Describes a "gesture" input, typically originating from a touch-input device. */
export class GestureInfo {
  public gestureId: GestureId;
  public numberTouches: number;
  public previousNumberTouches: number;    // Only meaningful for GestureId::SingleFingerMove and GestureId::MultiFingerMove
  public touches: Point2d[] = [new Point2d(), new Point2d(), new Point2d()];
  public ptsLocation: Point2d = new Point2d();              // Location of centroid
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

    for (let i = 0; i < this.numberTouches; i++) {
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

    for (let i = 0; i < this.numberTouches; i++) {
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
export class GestureEvent extends ButtonEvent {
  public gestureInfo?: GestureInfo;
  public init(vp: Viewport, gestureInfo: GestureInfo) {
    const current = s_toolAdmin.currentInputState;
    current.fromGesture(vp, gestureInfo, true);
    current.toEvent(this, false);
    if (gestureInfo.isFromMouse)
      this.actualInputSource = InputSource.Mouse;
  }
}

/** Information about movement of the "wheel" on the mouse. */
export class WheelMouseEvent extends ButtonEvent {
  public constructor(public wheelDelta: number = 0) { super(); }
}

export abstract class Tool {
  // tslint:disable:no-empty
  public constructor(public id: string) { }
  public abstract installToolImplementation(): void;
  public installTool() { return this.installToolImplementation(); }
  public onPostInstall() { }  // Override to execute additional logic after tool becomes active
  public onInstall() { return true; } // Override to execute additional logic when tool is installed. Return false to prevent this tool from becoming active
  public abstract onDataButtonDown(ev: ButtonEvent): void;   // Implement to handle data-button-down events
  public onDataButtonUp(_ev: ButtonEvent) { return false; } // Invoked when the data button is released.
  public onResetButtonDown(_ev: ButtonEvent) { return false; }  // Invoked when the reset button is pressed.
  public onResetButtonUp(_ev: ButtonEvent) { return false; }    // Invoked when the reset button is released.
  public onMiddleButtonDown(_ev: ButtonEvent) { return false; } // Invoked when the middle mouse button is pressed.
  public onMiddleButtonUp(_ev: ButtonEvent) { return false; }   // Invoked when the middle mouse button is released.
  public onModelMotion(_ev: ButtonEvent) { }    // Invoked when the cursor is moving
  public onModelNoMotion(_ev: ButtonEvent) { }  // Invoked when the cursor is not moving
  public onModelMotionStopped(_ev: ButtonEvent) { } // Invoked when the cursor was previously moving, and then stopped moving.
  public onModelStartDrag(_ev: ButtonEvent) { return false; }   // Invoked when the cursor begins moving while a button is depressed
  public onModelEndDrag(ev: ButtonEvent) { return this.onDataButtonDown(ev); } // Invoked when the cursor stops moving while a button is depressed
  public onMouseWheel(_ev: WheelMouseEvent) { return false; } // Invoked when the mouse wheel is used. @param {MouseWheelEvent} ev
  public abstract exitTool(): void;  // Implemented by direct subclasses to handle when the tool becomes no longer active. Generally not overridden by other subclasses
  public onCleanup() { } // Invoked when the tool becomes no longer active, to perform additional cleanup logic
  public onViewportResized() { }  // Invoked when the dimensions of the tool's viewport change
  public updateDynamics(_ev: ButtonEvent) { } // Invoked to allow a tool to update any view decorations it may have created
  public onTouchMotionPaused() { return false; }
  public onEndGesture(_ev: GestureEvent) { return false; }
  public onSingleFingerMove(_ev: GestureEvent) { return false; }
  public onMultiFingerMove(_ev: GestureEvent) { return false; }
  public onTwoFingerTap(_ev: GestureEvent) { return false; }
  public onPressAndTap(_ev: GestureEvent) { return false; }
  public onSingleTap(_ev: GestureEvent) { return false; }
  public onDoubleTap(_ev: GestureEvent) { return false; }
  public onLongPress(_ev: GestureEvent) { return false; }

  public isValidLocation(_ev: ButtonEvent, _isButtonEvent: boolean) { return true; }
  public isCompatibleViewport(vp: Viewport, _isSelectedViewChange: boolean) { return !!vp; }
}


export abstract class PrimitiveTool extends Tool {
  public targetView?: Viewport;
  public targetIsLocked: boolean; // If target model is known, set this to true in constructor and override getTargetModel.

  /** Called on data button down event in order to lock the tool to it's current target model. */
  public autoLockTarget(): void { if (!this.targetView) return; this.targetIsLocked = true; }
  public getCursor(): Cursor { return Cursor.Arrow; }
}
