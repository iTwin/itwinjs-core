/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Item */

import { ToolItemDef, CommandItemDef } from "./Item";
import { ItemDefBase } from "./ItemDefBase";
import { ItemPropsList, ItemProps } from "./ItemProps";
import { GroupItemDef } from "./GroupItem";

/** Contains a map of Items.
 */
export class ItemMap extends Map<string, ItemDefBase> {

  public loadItems(itemListDef?: ItemPropsList) {
    if (itemListDef && itemListDef.items) {
      itemListDef.items.map((itemDef, _index: number) => {
        const item = ItemFactory.Create(itemDef);
        if (item) {
          this.set(item.id, item);
        }
      });
    }
  }

  public addItem(item: ItemDefBase) {
    this.set(item.id, item);
  }
}

/** Contains a list of Items.
 */
export class ItemList {
  private _items: ItemDefBase[] = new Array<ItemDefBase>();

  constructor(itemPropsList?: ItemPropsList) {
    if (itemPropsList && itemPropsList.items) {
      itemPropsList.items.map((itemDef, _index) => {
        const item = ItemFactory.Create(itemDef);
        if (item) {
          this.addItem(item);
        }
      });
    }
  }

  public addItem(item: ItemDefBase) {
    this._items.push(item);
  }

  public get items(): ItemDefBase[] {
    return this._items;
  }
}

/** Factory class for creating an appropriate Item based on an ItemDef.
 */
export class ItemFactory {
  public static Create(def: ItemProps): ItemDefBase | undefined {
    if ("groupId" in def) {
      return new GroupItemDef(def);
    } else if ("toolId" in def) {
      return new ToolItemDef(def);
    } else if ("commandId" in def) {
      return new CommandItemDef(def);
    }

    return undefined;
  }
}
