/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utils */

/** A duration of time. Can be either positive (towards future) or negative (in the past).
 * BeDurations are immutable.
 */
export class BeDuration {
  private readonly _milliseconds: number;
  private constructor(milliseconds: number = 0) { this._milliseconds = milliseconds; }

  /** The duration in milliseconds */
  public get milliseconds() { return this._milliseconds; }
  public get seconds() { return this._milliseconds / 1000; }

  /** Create a BeDuration from seconds.
   * @param seconds the number of seconds for this BeDuration
   */
  public static fromSeconds(seconds: number) { return new BeDuration(seconds * 1000); }
  /** Create a BeDuration from milliseconds.
   * @param milliseconds the number of milliseconds for this BeDuration
   */
  public static fromMilliseconds(milliseconds: number) { return new BeDuration(milliseconds); }
  /** Determine whether this BeDuration is 0 seconds */
  public get isZero() { return this._milliseconds === 0; }
  /** Determine whether this BeDuration is towards the future */
  public get isTowardsFuture(): boolean { return this._milliseconds > 0; }
  /** Determine whether this BeDuration is towards the past */
  public get isTowardsPast(): boolean { return this._milliseconds < 0; }
  /** Subtract a BeDuration from this BeDuration, returning a new BeDuration. */
  public minus(other: BeDuration): BeDuration { return new BeDuration(this._milliseconds - other._milliseconds); }
  /** Add a BeDuration to this BeDuration, returning a new BeDuration */
  public plus(other: BeDuration): BeDuration { return new BeDuration(this._milliseconds + other._milliseconds); }

  /** Utility function to just wait for the specified time
   * @param ms Duration in milliseconds to wait
   * @return Promise that resolves after the specified wait period
   */
  public static async wait(ms: number): Promise<void> {
    return new Promise<void>((resolve: any) => setTimeout(resolve, ms));
  }
}

/** A specific point in time relative to the current time.
 * BeTimePoints are used for timing operations. They are created from a BeDuration relative to the "now".
 * BeTimePoints are immutable.
 */
export class BeTimePoint {
  private readonly _milliseconds: number;
  /** the time in milliseconds, of this BeTimePoint (relative to January 1, 1970 00:00:00 UTC.) */
  public get milliseconds() { return this._milliseconds; }
  private constructor(milliseconds: number) { this._milliseconds = milliseconds; }

  /** Create a BeTimePoint from Date.now() */
  public static now() { return new BeTimePoint(Date.now()); }

  /** Create a BeTimePoint at a specified duration in the future from now
   *  @param val the duration from now
   */
  public static fromNow(val: BeDuration) { return new BeTimePoint(Date.now() + val.milliseconds); }

  /** Create a BeTimePoint at a specified duration in the past before now
   * @param val the duration before now
   */
  public static beforeNow(val: BeDuration) { return new BeTimePoint(Date.now() - val.milliseconds); }

  /** Determine whether this BeTimePoint is a time in the future from the time this method is called (it calls now()!) */
  public get isInFuture(): boolean { return Date.now() < this._milliseconds; }

  /** Determine whether this BeTimePoint is a time that has already passed before the time this method is called (it calls now()!) */
  public get isInPast(): boolean { return Date.now() > this._milliseconds; }

  /** Determine whether this BeTimePoint happens before another one.
   * @param other the other BeTimePoint.
   */
  public before(other: BeTimePoint): boolean { return this._milliseconds < other._milliseconds; }

  /** Determine whether this BeTimePoint happens after another one.
   * @param other the other BeTimePoint.
   */
  public after(other: BeTimePoint): boolean { return this._milliseconds > other._milliseconds; }

  /** Subtract a BeDuration from this BeTimePoint, returning a new BeTimePoint. This moves this BeTimePoint backwards in time if BeDuration.isTowardsFuture() === true
   * @param duration the duration to subtract.
   */
  public minus(duration: BeDuration): BeTimePoint { return new BeTimePoint(this._milliseconds - duration.milliseconds); }

  /** Subtract a BeDuration from this BeTimePoint, returning a new BeTimePoint. This moves this BeTimePoint backwards in time if BeDuration.isTowardsFuture() === true
   * @param duration the duration to subtract.
   */
  public plus(duration: BeDuration) { return new BeTimePoint(this._milliseconds + duration.milliseconds); }
}

/** A StopWatch for timing operations. */
export class StopWatch {
  private _start?: BeTimePoint;
  private _stop?: BeTimePoint;
  /** Get the elapsed time since start() on a running timer. */
  public get current(): BeDuration { return BeDuration.fromMilliseconds(BeTimePoint.now().milliseconds - (!!this._start ? this._start.milliseconds : 0)); }
  /** Get the elapsed time, in seconds, since start() on a running timer. */
  public get currentSeconds(): number { return this.current.seconds; }
  /** Get the elapsed time between start() and stop() on this timer. */
  public get elapsed(): BeDuration { return BeDuration.fromMilliseconds((!!this._stop ? this._stop.milliseconds : BeTimePoint.now().milliseconds) - (!!this._start ? this._start.milliseconds : 0)); }
  /** Get the elapsed time, in seconds, between start() and stop() on this  timer. */
  public get elapsedSeconds(): number { return this.elapsed.seconds; }
  /** ctor for StopWatch
   * @param description optional string stored with the StopWatch
   * @param startImmediately if true, StopWatch is started when created. Otherwise, call start() explicitly.
   */
  constructor(public description?: string, startImmediately = false) { if (startImmediately) this.start(); }
  /** Start the stopwatch. Any future time measurements will be based on this new value. */
  public start(): void { this.reset(); this._start = BeTimePoint.now(); }
  /** Stop the stopwatch so that the duration can be viewed later. */
  public stop(): BeDuration { this._stop = BeTimePoint.now(); return this.elapsed; }
  /** Clear the StopWatch */
  public reset(): void { this._start = this._stop = undefined; }
}
