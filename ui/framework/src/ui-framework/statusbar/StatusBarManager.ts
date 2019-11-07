/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import { StatusBarItemsManager } from "./StatusBarItemsManager";

/** StatusBar Manager class.
 * @beta
 */
export class StatusBarManager {
  private _itemsManager = new StatusBarItemsManager();

  public get itemsManager() {
    return this._itemsManager;
  }
}
