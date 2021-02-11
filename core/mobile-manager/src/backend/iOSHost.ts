/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHostConfiguration, IpcHostOptions } from "@bentley/imodeljs-backend";
import { IpcWebSocketBackend } from "@bentley/imodeljs-common";
import { MobileDevice, MobileHost } from "./MobileHost";

/** @beta */
export class IOSHost extends MobileHost {
  /**
   * Start the backend of an IOS app.
   */
  public static async startup(opt?: { mobileHost?: { device: MobileDevice }, ipcHost?: IpcHostOptions, iModelHost?: IModelHostConfiguration }): Promise<void> {
    const device = opt?.mobileHost?.device ?? new (MobileDevice as any)();
    // The abstract functions of MobileDevice are implemented at runtime in native code.
    (global as any).__iTwinJsNativeBridge = device; // for native side
    const socket = opt?.ipcHost?.socket ?? new IpcWebSocketBackend();
    return MobileHost.startup({ ...opt, mobileHost: { device }, ipcHost: { socket } });
  }
}
