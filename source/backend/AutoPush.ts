/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelDb } from "./IModelDb";
import { AccessToken } from "@bentley/imodeljs-clients/lib";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { BeEvent } from "@bentley/bentleyjs-core/lib/BeEvent";

const loggingCategory = "imodeljs-backend.AutoPush";

export interface AppActivityMonitor {
  /** Check if the app is idle, that is, not busy. */
  isIdle(): boolean;
}

/** Configuration for AutoPush. */
export interface AutoPushParams {
  /** Desired delay in seconds between pushes. */
  pushIntervalSecondsMin: number;
  /** Maximum delay in seconds until the next push. */
  pushIntervalSecondsMax: number;
  /** Should AutoPush automatically schedule pushes? If not, the app must call [[AutoPush.scheduleNextPush]] */
  autoSchedule: boolean;
}

export enum AutoPushState {
  NotRunning,
  Scheduled,
  Pushing,
}

export enum AutoPushEventType {
  PushStarted,
  PushFinished,
  PushFailed,
  PushCancelled,
}

/** The signature of an AutoPush event handler. */
export type AutoPushEventHandler = (etype: AutoPushEventType, autoPush: AutoPush) => void;

 /** Automatically push local changes to a specified IModel. */
export class AutoPush {
  private _iModel: IModelDb;
  private _serviceAccountAccessToken: AccessToken;
  private _autoSchedule: boolean;
  private _pushIntervalMillisMin: number;
  private _pushIntervalMillisMax: number;
  private _endOfPushMillis: number;      // the time the last push finished (in unix millis)
  private _startOfPushMillis: number;    // the time the last push was started (in unix millis)
  private _state: AutoPushState;
  private _activityMonitor: AppActivityMonitor;
  private _lastPushError: any;
  private _pendingTimeout: any | undefined;
  /** Events rasied by AutoPush. See [[AutoPushEventType]] */
  public event: BeEvent<AutoPushEventHandler>;

  /** Construct an AutoPushManager.
   * @param params  Auto-push configuration parameters
   * @param serviceAccountAccessToken The service account that should be used to push
   * @param activityMonitor The activity monitor that will tell me when the app is idle
   */
  constructor(iModel: IModelDb, params: AutoPushParams, serviceAccountAccessToken: AccessToken, activityMonitor: AppActivityMonitor) {
    this._iModel = iModel;
    this._serviceAccountAccessToken = serviceAccountAccessToken;
    this._activityMonitor = activityMonitor;
    this._pushIntervalMillisMin = params.pushIntervalSecondsMin * 1000;
    this._pushIntervalMillisMax = params.pushIntervalSecondsMax * 1000;
    this._endOfPushMillis = Date.now(); // not true, but this sets the mark for detecting when we reach the max
    this._startOfPushMillis = this._endOfPushMillis + 1; // initialize to invalid duration
    this._lastPushError = undefined;
    this._state = AutoPushState.NotRunning;
    this._pendingTimeout = undefined;
    this.event = new BeEvent<AutoPushEventHandler>();
    this._autoSchedule = params.autoSchedule;
    if (this._autoSchedule)
      this.scheduleNextPush();
  }

  /** Cancel the next auto-push. Note that this also turns off auto-scheduling. */
  public cancel(): void {
    this._autoSchedule = false;

    if (this._state !== AutoPushState.Scheduled) {
      return;
    }

    clearTimeout(this._pendingTimeout);
    this._pendingTimeout = undefined;
    this._state = AutoPushState.NotRunning;
    this.onPushCancelled();
  }

  /** The autoSchedule property */
  public get autoSchedule(): boolean {
    return this._autoSchedule;
  }

  /** The autoSchedule property */
  public set autoSchedule(v: boolean) {
    this._autoSchedule = v;
    if (v)
      this.scheduleNextAutoPushIfNecessary();
  }

  /** The IModelDb that this is auto-pushing. */
  public get iModel(): IModelDb {
    return this._iModel;
  }

  /** The time that the last push finished in unix milliseconds. Returns 0 if no push has yet been done. */
  public get endOfLastPushMillis() {
    return (this._startOfPushMillis <= this._endOfPushMillis) ? this._endOfPushMillis : 0;
  }

  /** The length of time in milliseconds that the last push required in order to finish. Returns -1 if no push has yet been done. */
  public get durationOfLastPushMillis() {
    return this._endOfPushMillis - this._startOfPushMillis;
  }

  /** Check the current state of this AutoPush. */
  public get state(): AutoPushState {
    return this._state;
  }

  /** The last push error, if any.  */
  public get lastError(): any | undefined {
    return this._lastPushError;
  }

  // Schedules an auto-push, if none is already scheduled.
  public scheduleNextAutoPushIfNecessary() {
    if (this._state === AutoPushState.NotRunning)
      this.scheduleNextPush();
  }

  // Schedules an auto-push. See [[doAutoPush]].
  public scheduleNextPush(intervalSeconds?: number) {
    assert(this._state === AutoPushState.NotRunning);
    const intervalMillis = intervalSeconds ? (intervalSeconds * 1000) : this._pushIntervalMillisMin;
    this._pendingTimeout = setTimeout(() => this.doAutoPush(), intervalMillis);
    this._state = AutoPushState.Scheduled;
    Logger.logTrace(loggingCategory, "AutoPush - next push in " + (intervalMillis / 1000) + " seconds...");
  }

  public reserveCodes(): Promise<void> {
    return this._iModel.concurrencyControl.request(this._serviceAccountAccessToken);
  }

  private onPushStart() {
    Logger.logTrace(loggingCategory, "AutoPush - pushing...");
    this._state = AutoPushState.Pushing;
    this._startOfPushMillis = Date.now();
    if (this.event)
      this.event.raiseEvent(AutoPushEventType.PushStarted, this);
  }

  private onPushCancelled() {
    Logger.logTrace(loggingCategory, "AutoPush - cancelling.");
    assert(this._state === AutoPushState.NotRunning);
    if (this.event)
      this.event.raiseEvent(AutoPushEventType.PushCancelled, this);
  }

  private onPushEnd() {
    this._endOfPushMillis = Date.now();
    this._state = AutoPushState.NotRunning;
    this._pendingTimeout = undefined;
    this._lastPushError = undefined;
    Logger.logTrace(loggingCategory, "AutoPush - pushed.", () => ({changeSetId: this._iModel.iModelToken.changeSetId}));
    if (this._autoSchedule)
      this.scheduleNextPush();
    if (this.event)
      this.event.raiseEvent(AutoPushEventType.PushFinished, this); // handler can cancel, if it wants to
  }

  private onPushEndWithError(err: any) {
    this._state = AutoPushState.NotRunning;
    this._pendingTimeout = undefined;
    this._lastPushError = err;
    Logger.logInfo(loggingCategory, "AutoPush - push failed",  () => err);
    if (this._autoSchedule)
      this.scheduleNextPush();
    if (this.event)
      this.event.raiseEvent(AutoPushEventType.PushFailed, this);  // handler can cancel, if it wants to
    }

  //  Push changes, if there are changes and only if the backend is idle.
  private doAutoPush() {

    if (this.iModel === undefined) {
      Logger.logInfo(loggingCategory, "AutoPush - No iModel! Cancelling...");
      this.cancel();
      return;
    }

    //  If the previous push is still in progress ...
    if (this._state === AutoPushState.Pushing) {
      assert(this._pendingTimeout !== undefined);
      Logger.logInfo(loggingCategory, "AutoPush - Attempt to auto-push while push is in progress. Re-scheduling.");
      if (this._autoSchedule)
        this.scheduleNextPush();  // wait a while before trying another one.
      else
        this.cancel();          // don't push
      return;
    }

    // If the backend is busy, then put off the push for a little while, and wait for a lull.
    if (!this._activityMonitor.isIdle() && ((Date.now() - this._endOfPushMillis) < this._pushIntervalMillisMax)) {
      Logger.logInfo(loggingCategory, "AutoPush - Attempt to auto-push while backend is busy. Re-scheduling.");
      this.cancel();
      this.scheduleNextPush();
      return;
    }

    // We are either in lull or we have put off this push long enough. Start to push accumulated changes now.
    this.onPushStart();
    this.iModel.pushChanges(this._serviceAccountAccessToken, () => "no desc").then(() => this.onPushEnd()).catch((reason) => this.onPushEndWithError(reason));
    // Note that pushChanges is async. Don't await it here. That would block node's timer queue.
  }

}
