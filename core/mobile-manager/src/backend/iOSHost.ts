/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelHostConfiguration, IpcHostOptions } from "@bentley/imodeljs-backend";
import { IpcWebSocketBackend } from "@bentley/imodeljs-common";
import { BatteryState, Orientation } from "../common/MobileAppProps";
import { DownloadTask, MobileCompletionCallback, MobileDevice, MobileDeviceAuthSettings, MobileHost, MobileProgressCallback } from "./MobileHost";

type DeviceEvents = "memoryWarning" | "orientationChanged" | "enterForeground" | "enterBackground" | "willTerminate";

/** @beta */
export class IOSDevice extends MobileDevice {
  public emit(eventName: DeviceEvents, ...args: any[]) {
    switch (eventName) {
      case "memoryWarning":
        MobileHost.onMemoryWarning.raiseEvent(...args); break;
      case "orientationChanged":
        MobileHost.onOrientationChanged.raiseEvent(...args); break;
      case "enterForeground":
        MobileHost.onEnterForeground.raiseEvent(...args); break;
      case "enterBackground":
        MobileHost.onEnterBackground.raiseEvent(...args); break;
      case "willTerminate":
        MobileHost.onWillTerminate.raiseEvent(...args); break;
    }
  }

  public getOrientation(): Orientation { throw new Error("No native implementation registered."); }
  public getBatteryState(): BatteryState { throw new Error("No native implementation registered."); }
  public getBatteryLevel(): number { throw new Error("No native implementation registered."); }
  public createDownloadTask(_downloadUrl: string, _isBackground: boolean, _downloadTo: string, _completion: MobileCompletionCallback, _progress?: MobileProgressCallback): number { throw new Error("No native implementation registered."); }
  public cancelDownloadTask(_cancelId: number): boolean { throw new Error("No native implementation registered."); }
  public getDownloadTasks(): DownloadTask[] { throw new Error("No native implementation registered."); }
  public resumeDownloadInForeground(_requestId: number): boolean { throw new Error("No native implementation registered."); }
  public resumeDownloadInBackground(_requestId: number): boolean { throw new Error("No native implementation registered."); }
  public reconnect(_connection: number): void { throw new Error("No native implementation registered."); }
  public authSignIn(_ctx: ClientRequestContext, _callback: (err?: string) => void): void { throw new Error("No native implementation registered."); }
  public authSignOut(_ctx: ClientRequestContext, _callback: (err?: string) => void): void { throw new Error("No native implementation registered."); }
  public authGetAccessToken(_ctx: ClientRequestContext, _callback: (accessToken?: string, err?: string) => void): void { throw new Error("No native implementation registered."); }
  public authInit(_ctx: ClientRequestContext, _settings: MobileDeviceAuthSettings, _callback: (err?: string) => void): void { throw new Error("No native implementation registered."); }
  public authStateChanged(_accessToken?: string, _err?: string): void { throw new Error("No native implementation registered."); }
}

/** @beta */
export class IOSHost extends MobileHost {
  /**
   * Start the backend of an IOS app.
   */
  public static async startup(opt?: { mobileHost?: { device: MobileDevice }, ipcHost?: IpcHostOptions, iModelHost?: IModelHostConfiguration }): Promise<void> {
    const device = opt?.mobileHost?.device ?? new IOSDevice();
    const socket = opt?.ipcHost?.socket ?? new IpcWebSocketBackend();
    (global as any).MobileDeviceRpcImpl = device; // for native side
    return MobileHost.startup({ ...opt, mobileHost: { device }, ipcHost: { socket } });
  }
}
