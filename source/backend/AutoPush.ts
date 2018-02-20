/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelDb } from "./IModelDb";
import { AccessToken } from "@bentley/imodeljs-clients/lib";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";

const loggingCategory = "imodeljs-backend.AutoPush";

export interface AppActivityMonitor {
  /** Check if the app is idle, that is, not busy. */
  isIdle(): boolean;
}

/** Configuration for AutoPushManager. */
export interface AutoPushParams {
  /** Normal delay in seconds until the next round of changes are pushed */
  pushIntervalSecondsMin: number;
  /** Max delay in seconds until the next push */
  pushIntervalSecondsMax: number;
}

 /** Automatically push local changes to a specified IModel. */
export class AutoPush {
  private iModel: IModelDb;
  private serviceAccountAccessToken: AccessToken;
  private pushIntervalSecondsMin: number;
  private pushIntervalSecondsMax: number;
  private timeOfLastPushMillis: number;   // the time of the last push (in unix millis)
  private isPushing: boolean;             // a push is in progress?
  private autoPushScheduled: boolean;
  private activityMonitor: AppActivityMonitor;

  /** Construct an AutoPushManager.
   * @param params  Auto-push configuration parameters
   * @param serviceAccountAccessToken The service account that should be used to push
   * @param activityMonitor The activity monitor that will tell me when the app is idle
   */
  constructor(iModel: IModelDb, params: AutoPushParams, serviceAccountAccessToken: AccessToken, activityMonitor: AppActivityMonitor) {
    this.iModel = iModel;
    this.serviceAccountAccessToken = serviceAccountAccessToken;
    this.activityMonitor = activityMonitor;
    this.pushIntervalSecondsMin = params.pushIntervalSecondsMin;
    this.pushIntervalSecondsMax = params.pushIntervalSecondsMax;
    this.timeOfLastPushMillis = Date.now(); // not true, but this sets the mark for detecting when we reach the max
    this.isPushing = false;
    this.autoPushScheduled = false;
    this.scheduleNextAutoPush();
  }

  /** Cancel the next auto-push */
  public cancel(): void {
    this.autoPushScheduled = false;
  }

  /** Check if an auto-push is scheduled and pending. */
  public isScheduled(): boolean {
    return this.autoPushScheduled;
  }

  // Schedules an auto-push, if none is already scheduled.
  public scheduleNextAutoPushIfNecessary() {
    if (!this.autoPushScheduled)
      this.scheduleNextAutoPush();
  }

  // Schedules an auto-push. See [[doAutoPush]].
  public scheduleNextAutoPush(intervalSeconds?: number) {
    assert(!this.autoPushScheduled);
    if (intervalSeconds === undefined)
      intervalSeconds = this.pushIntervalSecondsMin;
    setTimeout(() => this.doAutoPush(), intervalSeconds! * 1000);
    this.autoPushScheduled = true;
    Logger.logInfo(loggingCategory, "AutoPush - next push in " + intervalSeconds! + " seconds...");
  }

  public reserveCodes(): Promise<void> {
    return this.iModel.concurrencyControl.request(this.serviceAccountAccessToken);
  }

  private onPushStart() {
    Logger.logInfo(loggingCategory, "AutoPush - pushing...");
    this.isPushing = true;
  }

  private onPushEnd() {
    this.timeOfLastPushMillis = Date.now();
    this.isPushing = false;
    Logger.logInfo(loggingCategory, "AutoPush - pushed.", () => ({changeSetId: this.iModel.iModelToken.changeSetId}));
    this.scheduleNextAutoPush();
  }

  private onPushEndWithError(err: any) {
    // Don't update timeOfLastPushMillis. That will leave me in the state where I think I must re-try the push as soon as possible.
    this.isPushing = false;
    Logger.logError(loggingCategory, "AutoPush - push failed",  () => err);
  }

  //  Push changes, if there are changes and only if the backend is idle.
  private doAutoPush() {
    if (!this.autoPushScheduled) {  // must have been cancelled by the user.
      return;
    }

    this.autoPushScheduled = false;

    if (this.iModel === undefined) {
      // We haven't had an update, so there's definitely nothing to push.
      // Don't even bother scheduling another auto-push now. Wait for an update, and that will schedule an auto-push.
      return;
    }

    //  If a push is in progress, then wait a while before trying another one.
    if (this.isPushing) {
      Logger.logInfo(loggingCategory, "AutoPush - Attempt to auto-push while push is in progress. Re-scheduling.");
      this.scheduleNextAutoPush();
      return;
    }

    // If the backend is busy, then put off the push for a little while, and wait for a lull.
    if (!this.activityMonitor.isIdle() && ((Date.now() - this.timeOfLastPushMillis) < this.pushIntervalSecondsMax)) {
      Logger.logInfo(loggingCategory, "AutoPush - Attempt to auto-push while backend is busy. Re-scheduling.");
      this.scheduleNextAutoPush();
      return;
    }

    // We are either in lull or we have put off this push long enough. Start to push accumulated changes now.
    this.onPushStart();
    this.iModel.pushChanges(this.serviceAccountAccessToken, () => "no desc").then(() => this.onPushEnd()).catch((reason) => this.onPushEndWithError(reason));
    // Note that pushChanges is async. Don't await it here. That would block node's timer queue.
  }

}
