/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Point2d, Range3d } from "@bentley/geometry-core";
import { BeTimePoint, assert } from "@bentley/bentleyjs-core";

export const enum StopMask {
  None = 0,
  OnKeystrokes = 1 << 0,
  OnWheel = 1 << 1,
  OnButton = 1 << 2,
  OnButtonUp = 1 << 3,
  OnReset = 1 << 4,
  OnResetUp = 1 << 5,
  OnPaint = 1 << 6,
  OnFocus = 1 << 7,
  OnModifierKey = 1 << 8,
  OnTouch = 1 << 9,
  OnAbortUpdate = 1 << 10,
  OnSensor = 1 << 11,   //  GPS, Gyro
  OnMouseMotion = 1 << 12,   //  any mouse movement
  AnyEvent = 1 << 13,   //  includes all of the other events plus unknown events

  ForFullUpdate = OnWheel | OnAbortUpdate | OnReset, // doesn't stop on keystrokes, data buttons, or touch
  ForQuickUpdate = ForFullUpdate | OnKeystrokes | OnButton | OnTouch,
  ForViewTransition = OnWheel | OnReset | OnKeystrokes | OnButton | OnTouch, // don't stop for "updateabort"
}

export class StopEvents {
  constructor(public keyStrokes: boolean = false,
    public wheel: boolean = false,
    public button: boolean = false,
    public buttonUp: boolean = false,
    public reset: boolean = false,
    public resetUp: boolean = false,
    public paint: boolean = false,
    public focus: boolean = false,
    public modifierKeyTransition: boolean = false,
    public sensor: boolean = false,
    public abortUpdateRequest: boolean = false,
    public touchMotion: boolean = false,
    public mouseMotion: boolean = false,
    public anyEvent: boolean = false,
    public touchLimit: number = 0,
    public numTouches: number = 0,
    public touches: Point2d[] = []) { }
  public clear(): void { this.keyStrokes = this.wheel = this.button = this.buttonUp = this.reset = this.resetUp = this.paint = this.focus = this.modifierKeyTransition = this.sensor = this.abortUpdateRequest = this.touchMotion = this.mouseMotion = this.anyEvent = false; this.touchLimit = 0; }
  public setStopOnModifierKey(stop: boolean): void { this.modifierKeyTransition = stop; }
  public setTouchLimit(limit: number, numTouches: number, touches: Point2d[]): void {
    this.touchMotion = true;
    this.touchLimit = limit;
    this.numTouches = numTouches >= 3 ? 3 : numTouches;
    for (let i = 0; i < numTouches; i++) this.touches[i] = touches[i];
  }
  public static fromStopMask(mask: StopMask): StopEvents {
    if (mask & StopMask.AnyEvent) mask = -1;
    return new StopEvents(0 !== (mask & StopMask.OnKeystrokes),
      0 !== (mask & StopMask.OnWheel),
      0 !== (mask & StopMask.OnButton),
      0 !== (mask & StopMask.OnButtonUp),
      0 !== (mask & StopMask.OnReset),
      0 !== (mask & StopMask.OnResetUp),
      0 !== (mask & StopMask.OnPaint),
      0 !== (mask & StopMask.OnFocus),
      0 !== (mask & StopMask.OnModifierKey),
      0 !== (mask & StopMask.OnSensor),
      0 !== (mask & StopMask.OnAbortUpdate),
      0 !== (mask & StopMask.OnTouch),
      0 !== (mask & StopMask.OnMouseMotion),
      0 !== (mask & StopMask.AnyEvent));
  }
}

export class Motion {
  constructor(public cursorPos: Point2d = new Point2d(),
    public tolerance: number = 0,
    public total: number = 0) { }
  public clear(): void { this.cursorPos.x = this.cursorPos.y = this.total = 0; }
  public addMotion(val: number): void { this.total += val; }
}

export class AbortFlags {
  public get wantMotionAbort(): boolean { return 0 !== this.motion.tolerance; }
  constructor(public stopEvents: StopEvents = StopEvents.fromStopMask(StopMask.ForFullUpdate),
    public motion = new Motion()) { }
  public setTouchCheckStopLimit(enabled: boolean, range: number, numTouches: number, touches: Point2d[]): void {
    if (!enabled) this.stopEvents.touchMotion = false;
    else this.stopEvents.setTouchLimit(range, numTouches, touches);
  }
}

export class TileOptions {
  public get hasDeadline(): boolean { return this.deadline !== undefined; }
  public get isTimedOut(): boolean { return this.hasDeadline && this.deadline!.isInPast(); }
  constructor(public deadline?: BeTimePoint,
    public scale: number = 1,
    public minDepth: number = 0,
    public maxDepth: number = 100) { }
  public setDepthRange(minDepth: number, maxDepth: number): void { this.minDepth = minDepth; this.maxDepth = maxDepth; }
  public setFixedDepth(depth: number): void { this.setDepthRange(depth, depth); }
  public isWithinDepthRange(depth: number): boolean { assert(this.minDepth <= this.maxDepth); return depth >= this.minDepth && depth <= this.maxDepth; }
}

export class UpdatePlan {
  public priority?: number;
  private _subRect?: Range3d;
  public quitTime?: BeTimePoint;
  public tileOptions: TileOptions = new TileOptions();
  public abortFlags: AbortFlags = new AbortFlags();
  public frustumScale: number = 1;
  public wantDecorators: boolean = true;
  public wantWait: boolean = false;
  public get hasSubRect(): boolean { return !!this._subRect; }
  public get subRect(): Range3d { return this._subRect!; }
  public set subRect(rect: Range3d) { this._subRect = rect; }
  public get hasQuitTime(): boolean { return this.quitTime !== undefined; }
  public get isTimedOut(): boolean { return this.hasQuitTime && this.quitTime!.isInPast(); }
  public clearAbortFlags(): void { this.abortFlags.stopEvents = StopEvents.fromStopMask(StopMask.None); }
}
