/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AsyncMethodsOf, BeEvent, Logger, PromiseReturnType } from "@itwin/core-bentley";
import { IModelReadRpcInterface, IModelTileRpcInterface, IpcWebSocketFrontend } from "@itwin/core-common";
import { IModelAppOptions, IpcApp, NativeApp, NativeAppOpts, NotificationHandler } from "@itwin/core-frontend";
import { mobileAppStrings } from "../common/MobileAppChannel";
import { MobileAppFunctions, MobileNotifications } from "../common/MobileAppProps";
import { MobileRpcManager } from "../common/MobileRpcManager";
import { MobileAuthorizationFrontend } from "./MobileAuthorizationFrontend";

/** @beta */
export type MobileAppOpts = NativeAppOpts & { iModelApp: { authorizationClient?: never } };

/** receive notifications from backend */
class MobileAppNotifyHandler extends NotificationHandler implements MobileNotifications {
  public get channelName() { return mobileAppStrings.mobileAppNotify; }

  public notifyMemoryWarning() {
    Logger.logWarning("mobileApp", "Low memory warning");
    if (MobileApp.onMemoryWarning.numberOfListeners === 0) {
      alert("Low memory warning");
    }
    MobileApp.onMemoryWarning.raiseEvent();
  }
  public notifyOrientationChanged() { MobileApp.onOrientationChanged.raiseEvent(); }
  public notifyWillTerminate() { MobileApp.onWillTerminate.raiseEvent(); }
  public notifyAuthAccessTokenChanged(accessToken: string | undefined, expirationDate: string | undefined) {
    MobileApp.onAuthAccessTokenChanged.raiseEvent(accessToken, expirationDate);
  }
}

/** @beta */
export class MobileApp {
  public static onMemoryWarning = new BeEvent<() => void>();
  public static onOrientationChanged = new BeEvent<() => void>();
  public static onEnterForeground = new BeEvent<() => void>();
  public static onEnterBackground = new BeEvent<() => void>();
  public static onWillTerminate = new BeEvent<() => void>();
  public static onAuthAccessTokenChanged = new BeEvent<(accessToken: string | undefined, expirationDate: string | undefined) => void>();
  public static async callBackend<T extends AsyncMethodsOf<MobileAppFunctions>>(methodName: T, ...args: Parameters<MobileAppFunctions[T]>) {
    return IpcApp.callIpcChannel(mobileAppStrings.mobileAppChannel, methodName, ...args) as PromiseReturnType<MobileAppFunctions[T]>;
  }

  private static _isValid = false;
  public static get isValid() { return this._isValid; }
  /** @beta */
  public static async startup(opts?: MobileAppOpts) {
    attachDirectEventCallbacks();

    const iModelAppOpts: IModelAppOptions = {
      ...opts?.iModelApp,
    };
    const authorizationClient = new MobileAuthorizationFrontend();
    iModelAppOpts.authorizationClient = authorizationClient;

    if (!this._isValid) {
      this.onAuthAccessTokenChanged.addListener((accessToken: string | undefined, expirationDate: string | undefined) => {
        authorizationClient.setAccessToken(accessToken, expirationDate);
      });

      const rpcInterfaces = opts?.iModelApp?.rpcInterfaces ?? [IModelReadRpcInterface, IModelTileRpcInterface]; // eslint-disable-line deprecation/deprecation
      MobileRpcManager.initializeClient(rpcInterfaces);
      this._isValid = true;
    }

    const socket = new IpcWebSocketFrontend(); // needs work
    await NativeApp.startup(socket, { ...opts, iModelApp: iModelAppOpts });

    MobileAppNotifyHandler.register(); // receives notifications from backend
  }
}

/*
  The suspend/resume lifecycle events cannot be reliably sent from the backend due to timing issues that arise when
  inter-operating with the actual suspend and resume behavior on the native side.
  Instead, they are sent directly to the browser here from platform-specific code.
*/
function attachDirectEventCallbacks() {
  (window as any)._imodeljs_rpc_lifecycle = (evt: "suspend" | "resume") => {
    if (evt === "suspend") {
      MobileApp.onEnterBackground.raiseEvent();
    } else if (evt === "resume") {
      MobileApp.onEnterForeground.raiseEvent();
    }
  };
}
