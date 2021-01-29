/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeEvent, Logger } from "@bentley/bentleyjs-core";
import { AsyncMethodsOf, IModelAppOptions, IpcApp, NativeApp, NotificationHandler, PromiseReturnType } from "@bentley/imodeljs-frontend";
import { mobileAppChannel, MobileAppFunctions, mobileAppNotify, MobileNotifications } from "../MobileAppProps";

/** receive notifications from backend */
class MobileAppNotifyHandler extends NotificationHandler implements MobileNotifications {
  public get channelName() { return mobileAppNotify; }

  public notifyMemoryWarning() {
    Logger.logWarning("mobileApp", "Low memory warning");
    if (MobileApp.onMemoryWarning.numberOfListeners === 0) {
      alert("Low memory warning");
    }
    MobileApp.onMemoryWarning.raiseEvent();
  }
  public notifyOrientationChanged() { MobileApp.onOrientationChanged.raiseEvent(); }
  public notifyEnterForeground() { MobileApp.onEnterBackground.raiseEvent(); }
  public notifyEnterBackground() { MobileApp.onEnterBackground.raiseEvent(); }
  public notifyWillTerminate() { MobileApp.onWillTerminate.raiseEvent(); }

}

export class MobileApp {
  public static onMemoryWarning = new BeEvent<() => void>();
  public static onOrientationChanged = new BeEvent<() => void>();
  public static onEnterForeground = new BeEvent<() => void>();
  public static onEnterBackground = new BeEvent<() => void>();
  public static onWillTerminate = new BeEvent<() => void>();
  public static async callBackend<T extends AsyncMethodsOf<MobileAppFunctions>>(methodName: T, ...args: Parameters<MobileAppFunctions[T]>) {
    return IpcApp.callBackend(mobileAppChannel, methodName, ...args) as PromiseReturnType<MobileAppFunctions[T]>;
  }

  private static _isValid = false;
  public static get isValid() { return this._isValid; }
  /**
   * This is called by either ElectronApp.startup or MobileApp.startup - it should not be called directly
   * @internal
   */
  public static async startup(opts: { iModelApp?: IModelAppOptions }) {

    await NativeApp.startup(opts);
    if (this._isValid)
      return;
    this._isValid = true;

    MobileAppNotifyHandler.register(); // receives notifications from backend
  }
}
