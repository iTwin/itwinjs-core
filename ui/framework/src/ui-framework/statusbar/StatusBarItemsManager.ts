/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import { UiEvent } from "@bentley/ui-core";
import { StatusBarItem, StatusBarItemId } from "./StatusBarItem";

/** StatusBar Items Changed Event class.
 * @beta
 */
export class StatusBarItemsChangedEvent extends UiEvent<{}> { }

type InstanceOrArray<T> = T | ReadonlyArray<T>;

const isInstance = <T extends any>(args: InstanceOrArray<T>): args is T => {
  return !Array.isArray(args);
};

/** StatusBar Items Manager class.
 * @beta
 */
export class StatusBarItemsManager {
  private _items: ReadonlyArray<StatusBarItem> = [];

  /** Event raised when StatusBar items are changed. */
  public readonly onItemsChanged = new StatusBarItemsChangedEvent();

  /** Get an array of the StatusBar items  */
  public get items(): ReadonlyArray<StatusBarItem> {
    return this._items;
  }

  /** @internal */
  public set items(items: ReadonlyArray<StatusBarItem>) {
    if (this._items === items)
      return;
    this._items = items;
    this.onItemsChanged.emit({ items });
  }

  /** Add a StatusBar item or an array of the StatusBar items  */
  public add(itemOrItems: StatusBarItem | ReadonlyArray<StatusBarItem>) {
    let itemsToAdd;
    if (isInstance(itemOrItems))
      itemsToAdd = [itemOrItems];
    else {
      itemsToAdd = itemOrItems.filter((itemToAdd, index) => itemOrItems.findIndex((item) => item.id === itemToAdd.id) === index);
    }
    itemsToAdd = itemsToAdd.filter((itemToAdd) => this._items.find((item) => item.id === itemToAdd.id) === undefined);
    if (itemsToAdd.length === 0)
      return;
    const items = [
      ...this._items,
      ...itemsToAdd,
    ];
    this.items = items;
  }

  /** Remove StatusBar items based on id */
  public remove(itemIdOrItemIds: StatusBarItemId | ReadonlyArray<StatusBarItemId>) {
    const items = this._items.filter((item) => {
      return isInstance(itemIdOrItemIds) ? item.id !== itemIdOrItemIds : !itemIdOrItemIds.find((itemId) => itemId === item.id);
    });
    this.items = items;
  }

  /** Set the visibility of a StatusBar item */
  public setIsVisible(id: StatusBarItemId, isVisible: boolean) {
    const itemIndex = this._items.findIndex((i) => i.id === id);
    if (itemIndex < 0)
      return;

    const prevItem = this._items[itemIndex];
    if (prevItem.isVisible === isVisible)
      return;

    const item = {
      ...prevItem,
      isVisible,
    };
    this.items = [
      ...this._items.slice(0, itemIndex),
      item,
      ...this._items.slice(itemIndex + 1),
    ];
  }

  /** @internal */
  public removeAll() {
    this._items = [];
  }

}
