/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

export class BeDuration {
  private _milliseconds: number;
  public get milliseconds() { return this._milliseconds; }
  private constructor(milliseconds: number = 0) { this._milliseconds = milliseconds; }
  public static fromSeconds(seconds: number) { return new BeDuration(seconds * 1000); }
  public static fromMilliseconds(milliseconds: number) { return new BeDuration(milliseconds); }
  public get seconds() { return this._milliseconds / 1000; }
  public isZero() { return this._milliseconds === 0; }
  public isTowardsFuture() { return this._milliseconds > 0; }
  public isTowardsPast() { return this._milliseconds < 0; }
  public minus(other: BeDuration) { return new BeDuration(this._milliseconds - other._milliseconds); }
  public plus(other: BeDuration) { return new BeDuration(this._milliseconds + other._milliseconds); }
}

export class BeTimePoint {
  private _milliseconds: number;
  public get milliseconds() { return this._milliseconds; }
  private constructor(millis: number) { this._milliseconds = millis; }
  public static now() { return new BeTimePoint(Date.now()); }

  /** Get a BeTimePoint at a specified duration in the future from now
   *  @param val the duration from now
   */
  public static fromNow(val: BeDuration) { return new BeTimePoint(Date.now() + val.milliseconds); }

  /** Get a BeTimePoint at a specified duration in the past before now
   * @param val the duration before now
   */
  public static beforeNow(val: BeDuration) { return new BeTimePoint(Date.now() - val.milliseconds); }

  /** Determine whether this BeTimePoint is valid (non-zero) */
  public isValid() { return 0 !== this._milliseconds; }

  /** return true if this BeTimePoint is a valid time in the future from the time this method is called (it calls now()!)
   * @note always returns false and does not call Now() if this is not a valid BeTimePoint
   */
  public isInFuture() { return this.isValid() && (Date.now() < this._milliseconds); }

  /** return true if this BeTimePoint was a valid time that has past before the time this method is called (it calls now()!)
   * @note always returns false and does not call Now() if this is not a valid BeTimePoint
   */
  public isInPast() { return this.isValid() && (Date.now() > this._milliseconds); }

  public before(other: BeTimePoint) { return this._milliseconds < other._milliseconds; }
  public after(other: BeTimePoint) { return this._milliseconds > other._milliseconds; }
  public minus(duration: BeDuration) { return new BeTimePoint(this._milliseconds - duration.milliseconds); }
  public plus(duration: BeDuration) { return new BeTimePoint(this._milliseconds + duration.milliseconds); }
}

export class StopWatch {
  private _start?: BeTimePoint = undefined;
  private _stop?: BeTimePoint = undefined;
  /** Get the elapsed time since Start() on a running timer. */
  public get current(): BeDuration { return BeDuration.fromMilliseconds(StopWatch.now().milliseconds - (!!this._start ? this._start.milliseconds : 0)); }
  public get currentSeconds(): number { return this.current.seconds; }
  /** Get the elapsed time between Start() and Stop() on this timer. */
  public get elapsed(): BeDuration { return BeDuration.fromMilliseconds((!!this._stop ? this._stop.milliseconds : StopWatch.now().milliseconds) - (!!this._start ? this._start.milliseconds : 0)); }
  public get elapsedSeconds(): number { return this.elapsed.seconds; }
  public static now(): BeTimePoint { return BeTimePoint.now(); }
  constructor(public description?: string, startImmediately: boolean = false) { if (startImmediately) this.start(); }
  /** Start or restart the stopwatch. Any future time measurements will be based on this new value. */
  public start(): void { this.reset(); this._start = StopWatch.now(); }
  /** Stop the stopwatch so that the duration can be viewed later. */
  public stop(): BeDuration { this._stop = StopWatch.now(); return this.elapsed; }
  public reset(): void { this._start = this._stop = undefined; }
}
