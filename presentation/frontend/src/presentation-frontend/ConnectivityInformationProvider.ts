/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { BeEvent, IDisposable } from "@itwin/core-bentley";
import { InternetConnectivityStatus } from "@itwin/core-common";
import { NativeApp } from "@itwin/core-frontend";

/** @internal */
export interface IConnectivityInformationProvider {
  readonly status: InternetConnectivityStatus;
  readonly onInternetConnectivityChanged: BeEvent<(args: { status: InternetConnectivityStatus }) => void>;
}

/**
 * A helper that wraps connectivity-related APIs in NativeApp
 * to give a unified information for interested parties in presentation.
 *
 * @internal
 */
export class ConnectivityInformationProvider implements IConnectivityInformationProvider, IDisposable {

  private _currentStatus?: InternetConnectivityStatus;
  private _unsubscribeFromInternetConnectivityChangedEvent?: () => void;
  public readonly onInternetConnectivityChanged = new BeEvent<(args: { status: InternetConnectivityStatus }) => void>();

  public constructor() {
    if (NativeApp.isValid) {
      this._unsubscribeFromInternetConnectivityChangedEvent = NativeApp.onInternetConnectivityChanged.addListener(this.onNativeAppInternetConnectivityChanged);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      NativeApp.checkInternetConnectivity().then((status: InternetConnectivityStatus) => {
        if (undefined === this._currentStatus)
          this._currentStatus = status;
      });
    } else {
      this._currentStatus = InternetConnectivityStatus.Online;
    }
  }

  public dispose() {
    this._unsubscribeFromInternetConnectivityChangedEvent && this._unsubscribeFromInternetConnectivityChangedEvent();
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onNativeAppInternetConnectivityChanged = (status: InternetConnectivityStatus) => {
    if (this._currentStatus === status)
      return;

    this._currentStatus = status;
    this.onInternetConnectivityChanged.raiseEvent({ status });
  };

  public get status(): InternetConnectivityStatus { return this._currentStatus ?? InternetConnectivityStatus.Offline; }
}
