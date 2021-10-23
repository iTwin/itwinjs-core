/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ConfigurableUi
 */

import { ConfigurableUiManager } from "./ConfigurableUiManager";

// cspell:ignore visibilitychange

/** Properties for [[ActivityTracker]]
 * @internal
 */
export interface ActivityTrackerProps {
  idleTimeout?: number;
  intervalTimeout?: number;
}

/** Activity Tracker utility class
 * @internal
 */
export class ActivityTracker {
  private _intervalId?: any;
  private _idleTimeout?: number;
  private _intervalTimeout = 1000;

  private _events = [
    "keydown",
    "wheel",
    "scroll",
    "mousedown",
    "mousemove",
    "touchstart",
    "touchmove",
    "pointerdown",
    "pointermove",
    "visibilitychange",
  ];

  /** Initializes the time tracker and adds event listeners
   */
  public initialize(props?: ActivityTrackerProps): void {
    // istanbul ignore else
    if (props) {
      this._idleTimeout = props.idleTimeout;
      if (props.intervalTimeout !== undefined)
        this._intervalTimeout = props.intervalTimeout;
    }

    this._bindEvents();

    this._intervalId = setInterval(this._trackUiInterval, this._intervalTimeout);
  }

  /** Terminates the time tracker and removes event listeners
   */
  public terminate(): void {
    this._unbindEvents();

    // istanbul ignore else
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = undefined;
    }
  }

  private _bindEvents = (): void => {
    this._events.forEach((e) => {
      window.addEventListener(e, this._trackUiActivity, { capture: true });
    });
  };

  private _unbindEvents = (): void => {
    this._events.forEach((e) => {
      window.removeEventListener(e, this._trackUiActivity, { capture: true });
    });
  };

  private _trackUiInterval = (): void => {
    ConfigurableUiManager.onUiIntervalEvent.emit({ idleTimeout: this._idleTimeout });
  };

  private _trackUiActivity = (event: Event): void => {
    ConfigurableUiManager.onUiActivityEvent.emit({ event });
  };
}
