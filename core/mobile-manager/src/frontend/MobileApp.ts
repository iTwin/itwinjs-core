/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeEvent, Logger } from "@bentley/bentleyjs-core";
import { IModelReadRpcInterface, IModelTileRpcInterface, IpcWebSocketFrontend } from "@bentley/imodeljs-common";
import { AsyncMethodsOf, IpcApp, NativeApp, NativeAppOpts, NotificationHandler, PromiseReturnType } from "@bentley/imodeljs-frontend";
import { mobileAppChannel, MobileAppFunctions, mobileAppNotify, MobileNotifications } from "../common/MobileAppProps";
import { MobileRpcManager } from "../common/MobileRpcManager";

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

/** @beta */
export class MobileApp {
  public static onMemoryWarning = new BeEvent<() => void>();
  public static onOrientationChanged = new BeEvent<() => void>();
  public static onEnterForeground = new BeEvent<() => void>();
  public static onEnterBackground = new BeEvent<() => void>();
  public static onWillTerminate = new BeEvent<() => void>();
  public static async callBackend<T extends AsyncMethodsOf<MobileAppFunctions>>(methodName: T, ...args: Parameters<MobileAppFunctions[T]>) {
    return IpcApp.callIpcChannel(mobileAppChannel, methodName, ...args) as PromiseReturnType<MobileAppFunctions[T]>;
  }

  private static _isValid = false;
  public static get isValid() { return this._isValid; }
  /**
   * This is called by either ElectronApp.startup or MobileApp.startup - it should not be called directly
   * @internal
   */
  public static async startup(opts?: NativeAppOpts) {
    if (!this._isValid) {
      const rpcInterfaces = opts?.iModelApp?.rpcInterfaces ?? [IModelReadRpcInterface, IModelTileRpcInterface];
      MobileRpcManager.initializeClient(rpcInterfaces);
      this._isValid = true;
    }
    const socket = new IpcWebSocketFrontend(); // needs work
    await NativeApp.startup(socket, opts);

    MobileAppNotifyHandler.register(); // receives notifications from backend
  }
}
