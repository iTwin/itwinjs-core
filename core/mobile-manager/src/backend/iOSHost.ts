/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHostConfiguration, IpcHostOptions } from "@bentley/imodeljs-backend";
import { IpcWebSocketBackend } from "@bentley/imodeljs-common";
import { MobileDevice, MobileHost } from "./MobileHost";

/** @beta */
export abstract class IOSDevice extends MobileDevice {
}

/** The abstract functions of this device class are implemented at runtime on the native side. */
abstract class NativeBridge extends IOSDevice {
  public constructor() {
    super();
    (global as any).__iTwinJsNativeBridge = this; // for native side
  }
}

/** @beta */
export class IOSHost extends MobileHost {
  /**
   * Start the backend of an IOS app.
   */
  public static async startup(opt?: { mobileHost?: { device: IOSDevice }, ipcHost?: IpcHostOptions, iModelHost?: IModelHostConfiguration }): Promise<void> {
    const device = opt?.mobileHost?.device ?? new (NativeBridge as any)();
    const socket = opt?.ipcHost?.socket ?? new IpcWebSocketBackend();
    return MobileHost.startup({ ...opt, mobileHost: { device }, ipcHost: { socket } });
  }
}
