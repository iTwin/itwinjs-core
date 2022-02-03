/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ConfigurableUi
 */

import type { UiActivityEventArgs, UiIntervalEventArgs } from "./ConfigurableUiManager";
import { ConfigurableUiManager } from "./ConfigurableUiManager";

/** Time Tracker utility class
 * @internal
 */
export class TimeTracker {
  private _firstActiveTimestamp: number = 0;
  private _idleStartTimestamp: number = 0;
  private _lastActiveTimestamp: number = 0;
  private _totalIdleTime: number = 0;
  private _idleCount: number = 0;
  private _idleTimeout: number = 5000;
  private _totalTime: number = 0;
  private _idleTime: number = 0;

  /** Starts time tracking
   */
  public startTiming(): void {
    this._totalIdleTime = 0;
    this._idleStartTimestamp = 0;
    this._idleCount = 0;
    this._totalTime = 0;
    this._idleTime = 0;

    this._firstActiveTimestamp = Date.now();
    this._lastActiveTimestamp = this._firstActiveTimestamp;

    ConfigurableUiManager.onUiIntervalEvent.addListener(this._idleTimeCounter);
    ConfigurableUiManager.onUiActivityEvent.addListener(this._trackActivity);
  }

  /** Stops time tracking
   */
  public stopTiming(): void {
    ConfigurableUiManager.onUiIntervalEvent.removeListener(this._idleTimeCounter);
    ConfigurableUiManager.onUiActivityEvent.removeListener(this._trackActivity);

    this._totalTime = Date.now() - this._firstActiveTimestamp;
    this._idleTime = this._totalIdleTime + this._idleCount * this._idleTimeout;
  }

  /** Gets engagement time in seconds
   */
  public getEngagementTimeSeconds(): number {
    return (this._totalTime - this._idleTime) / 1000;
  }

  /** Gets total time in seconds
   */
  public getTotalTimeSeconds(): number {
    return this._totalTime / 1000;
  }

  /** Gets idle time in seconds
   */
  public getIdleTimeSeconds(): number {
    return this._idleTime / 1000;
  }

  private _idleTimeCounter = (args: UiIntervalEventArgs): void => {
    // istanbul ignore next
    const idleTimeout = args.idleTimeout ?? this._idleTimeout;
    // istanbul ignore else
    if (this._lastActiveTimestamp > 0 && this._idleStartTimestamp === 0 && Date.now() - this._lastActiveTimestamp >= idleTimeout) {
      this._idleStartTimestamp = Date.now();
      this._idleCount++;
    }
  };

  private _trackActivity = (_args: UiActivityEventArgs): void => {
    this._lastActiveTimestamp = Date.now();

    if (this._idleStartTimestamp > 0) {
      const lastIdleTime = this._lastActiveTimestamp - this._idleStartTimestamp;
      this._totalIdleTime += lastIdleTime;
      this._idleStartTimestamp = 0;
    }
  };
}
