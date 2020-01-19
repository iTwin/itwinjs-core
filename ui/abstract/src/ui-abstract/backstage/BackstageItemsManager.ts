/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import { BeEvent } from "@bentley/bentleyjs-core";
import { BackstageItem } from "./BackstageItem";

/** Arguments of [[BackstageItemsManager.onChanged]] event.
 * @internal
 */
export interface BackstageItemsChangedArgs {
  readonly items: ReadonlyArray<BackstageItem>;
}

type InstanceOrArray<T> = T | ReadonlyArray<T>;

const isInstance = <T extends any>(args: InstanceOrArray<T>): args is T => {
  return !Array.isArray(args);
};

/**
 * Controls backstage items.
 * @beta
 */
export class BackstageItemsManager {
  private _items: ReadonlyArray<BackstageItem> = [];

  /** Event raised when backstage items are changed.
   * @internal
   */
  public readonly onChanged = new BeEvent<(args: BackstageItemsChangedArgs) => void>();

  public get items(): ReadonlyArray<BackstageItem> {
    return this._items;
  }

  public set items(items: ReadonlyArray<BackstageItem>) {
    if (this._items === items)
      return;
    this._items = items;
    this.onChanged.raiseEvent({ items });
  }

  public setIsVisible(id: BackstageItem["id"], isVisible: boolean) {
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

  public setIsEnabled(id: BackstageItem["id"], isEnabled: boolean) {
    const itemIndex = this._items.findIndex((i) => i.id === id);
    if (itemIndex < 0)
      return;

    const prevItem = this._items[itemIndex];
    if (prevItem.isEnabled === isEnabled)
      return;

    const item = {
      ...prevItem,
      isEnabled,
    };
    this.items = [
      ...this._items.slice(0, itemIndex),
      item,
      ...this._items.slice(itemIndex + 1),
    ];
  }

  public add(itemOrItems: BackstageItem | ReadonlyArray<BackstageItem>) {
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

  public remove(itemIdOrItemIds: BackstageItem["id"] | ReadonlyArray<BackstageItem["id"]>) {
    const items = this._items.filter((item) => {
      return isInstance(itemIdOrItemIds) ? item.id !== itemIdOrItemIds : !itemIdOrItemIds.find((itemId) => itemId === item.id);
    });
    this.items = items;
  }
}
