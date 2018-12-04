/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { ItemDefBase } from "./ItemDefBase";

/** Contains a map of Items.
 */
export class ItemMap extends Map<string, ItemDefBase> {
  public addItem(item: ItemDefBase) {
    this.set(item.id, item);
  }
}

/** Contains a list of Items.
 */
export class ItemList {
  private _items: ItemDefBase[] = new Array<ItemDefBase>();

  public addItem(item: ItemDefBase) {
    this._items.push(item);
  }

  public get items(): ItemDefBase[] {
    return this._items;
  }
}
