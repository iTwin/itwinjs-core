/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { NativeAppOpts } from "@itwin/core-frontend";
import { MobileApp } from "./MobileApp";

/** @beta */
export type IOSAppOpts = NativeAppOpts;

/** @beta */
export class IOSApp {

  private static _isValid = false;
  public static get isValid() { return this._isValid; }
  public static async startup(opts?: IOSAppOpts) {
    if (!this._isValid) {
      this._isValid = true;
    }
    await MobileApp.startup(opts);
  }
}
