/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

/** Signature for [Timer] execute callback. */
export type ExecuteHandler = (this: void) => void;

/** Notifies handler after a set interval. */
export default class Timer {
  private _delay: number;
  private _isRunning = false;
  private _timerId = 0;
  private _onExecute: ExecuteHandler | undefined;

  /**
   * Creates a new Timer.
   * @param msDelay Time interval in milliseconds after which handler will be notified.
   */
  public constructor(msDelay: number) {
    this._delay = msDelay;
  }

  /** Indicates whether the timer is running */
  public get isRunning(): boolean {
    return this._isRunning;
  }

  /** Time interval in milliseconds after which handler will be notified */
  public set delay(ms: number) {
    this._delay = ms;
  }

  /** Time interval in milliseconds after which handler will be notified */
  public get delay() {
    return this._delay;
  }

  /** Set handler that is called after a set interval. */
  public setOnExecute(onExecute: ExecuteHandler | undefined) {
    this._onExecute = onExecute;
  }

  /** Starts this Timer. */
  public start() {
    if (this._isRunning)
      this.clearTimeout();

    this._isRunning = true;
    this.setTimeout();
  }

  /** Stops this Timer. */
  public stop() {
    if (!this._isRunning)
      return;

    this._isRunning = false;
    this.clearTimeout();
  }

  private execute() {
    this._onExecute && this._onExecute();
    this._isRunning = false;
  }

  private setTimeout() {
    this._timerId = window.setTimeout(() => this.execute(), this._delay);
  }

  private clearTimeout() {
    window.clearTimeout(this._timerId);
  }
}
