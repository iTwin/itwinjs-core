/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelAppOptions } from "@bentley/imodeljs-frontend";
import { MobileApp } from "./MobileApp";

/** @beta */
export class IOSApp {

  private static _isValid = false;
  public static get isValid() { return this._isValid; }
  public static async startup(opts?: { iModelApp?: IModelAppOptions }) {
    if (!this._isValid) {
      this._isValid = true;
    }
    await MobileApp.startup(opts);
  }
}
