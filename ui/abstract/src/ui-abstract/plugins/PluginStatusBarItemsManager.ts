/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Plugins */

import { BeEvent } from "@bentley/bentleyjs-core";
import { CommonStatusBarItem } from "../items/StatusBarItem";

type InstanceOrArray<T> = T | ReadonlyArray<T>;

const isInstance = <T extends any>(args: InstanceOrArray<T>): args is T => {
  return !Array.isArray(args);
};

/** Arguments of [[StatusbarItemsManager.onChanged]] event.
 * @internal
 */
export interface PluginStatusbarItemsChangedArgs {
  readonly items: ReadonlyArray<CommonStatusBarItem>;
}

/**
 * Controls status bar items.
 * @beta
 */
export class PluginStatusBarItemsManager {
  private _items: ReadonlyArray<CommonStatusBarItem> = [];

  /** Event raised when backstage items are changed.
   * @internal
   */
  public readonly onItemsChanged = new BeEvent<(args: PluginStatusbarItemsChangedArgs) => void>();

  /** load items but do not fire onItemsChanged
   * @internal
   */
  public loadItems(items: ReadonlyArray<CommonStatusBarItem>) {
    this._items = items;
  }

  /** Get an array of the StatusBar items  */
  public get items(): ReadonlyArray<CommonStatusBarItem> {
    return this._items;
  }

  /** @internal */
  public set items(items: ReadonlyArray<CommonStatusBarItem>) {
    if (this._items === items)
      return;
    this._items = items;
    this.onItemsChanged.raiseEvent({ items });
  }

  public setIsVisible(id: CommonStatusBarItem["id"], isVisible: boolean) {
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

  /** Set Label on statusbar items that support labels */
  public setLabel(id: CommonStatusBarItem["id"], label: string) {
    const itemIndex = this._items.findIndex((i) => i.id === id);
    if (itemIndex < 0)
      return;

    const prevItem = this._items[itemIndex];

    if (!("label" in prevItem) || (prevItem.label === label))
      return;

    const item = {
      ...prevItem,
      label,
    };
    this.items = [
      ...this._items.slice(0, itemIndex),
      item,
      ...this._items.slice(itemIndex + 1),
    ];
  }

  /** Set Tooltip on statusbar items that support tooltip string. */
  public setTooltip(id: CommonStatusBarItem["id"], tooltip: string) {
    const itemIndex = this._items.findIndex((i) => i.id === id);
    if (itemIndex < 0)
      return;

    const prevItem = this._items[itemIndex];

    if (!("tooltip" in prevItem) || (prevItem.tooltip === tooltip))
      return;

    const item = {
      ...prevItem,
      tooltip,
    };
    this.items = [
      ...this._items.slice(0, itemIndex),
      item,
      ...this._items.slice(itemIndex + 1),
    ];
  }

  public add(itemOrItems: CommonStatusBarItem | ReadonlyArray<CommonStatusBarItem>) {
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

  public remove(itemIdOrItemIds: CommonStatusBarItem["id"] | ReadonlyArray<CommonStatusBarItem["id"]>) {
    const items = this._items.filter((item) => {
      return isInstance(itemIdOrItemIds) ? item.id !== itemIdOrItemIds : !itemIdOrItemIds.find((itemId) => itemId === item.id);
    });
    this.items = items;
  }
}
