/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import { Logger } from "@bentley/bentleyjs-core";

import { StatusBarItemsManager } from "./StatusBarItemsManager";
import { UiFramework } from "../UiFramework";

/** StatusBar Manager class.
 * @beta
 */
export class StatusBarManager {
  private _itemsManagerMap = new Map<string, StatusBarItemsManager>();

  /** Get a StatusBar items manager by id */
  public getItemsManager(id: string): StatusBarItemsManager | undefined {
    return this._itemsManagerMap.get(id);
  }

  /** Add a StatusBar items manager by id */
  public addItemsManager(id: string, itemsManager: StatusBarItemsManager): boolean {
    let status = true;
    if (!this._itemsManagerMap.has(id)) {
      this._itemsManagerMap.set(id, itemsManager);
    } else {
      Logger.logTrace(UiFramework.loggerCategory(this), `addItemsManager - cannot add manager with id '${id}' because it exists already`);
      status = false;
    }
    return status;
  }

  /** Remove a StatusBar items manager by id */
  public removeItemsManager(id: string): boolean {
    let status = true;
    if (this._itemsManagerMap.has(id)) {
      this._itemsManagerMap.delete(id);
    } else {
      status = false;
    }
    return status;
  }

  /** @internal */
  public removeAll(): void {
    this._itemsManagerMap.clear();
  }
}
