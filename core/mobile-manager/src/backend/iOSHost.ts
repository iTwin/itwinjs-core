/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IpcHostOptions, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { MobileDevice, MobileHost } from "./MobileHost";

/** @beta */
export abstract class IOSDevice extends MobileDevice {
  // implement and remove abstract
}

/** @beta */
export class IOSHost extends MobileHost {
  /**
   * Start the backend of an IOS app.
   */
  public static async startup(opt?: { mobileHost: { device: MobileDevice }, ipcHost?: IpcHostOptions, iModelHost?: IModelHostConfiguration }): Promise<void> {
    // enable once IOSDevice is working
    // if (!opt) {
    //   opt = { mobileHost: { device: new IOSDevice() } };
    // }

    // if (!opt.ipcHost) {
    //   opt.ipcHost = { socket: new IpcWebSocketBackend() };
    // }

    await MobileHost.startup(opt);
  }
}
