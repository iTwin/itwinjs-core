/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import { BeEvent } from "@bentley/bentleyjs-core";
import { ConditionalBooleanValue } from "../items/ConditionalBooleanValue";
import { ConditionalStringValue } from "../items/ConditionalStringValue";
import { CommonStatusBarItem, StatusBarItemId } from "./StatusBarItem";

type InstanceOrArray<T> = T | ReadonlyArray<T>;

const isInstance = <T extends any>(args: InstanceOrArray<T>): args is T => {
  return !Array.isArray(args);
};

/** Arguments of [[StatusBarItemsManager.onChanged]] event.
 * @internal
 */
export interface StatusBarItemsChangedArgs {
  readonly items: ReadonlyArray<CommonStatusBarItem>;
}

/**
 * Controls status bar items.
 * @internal
 */
export class StatusBarItemsManager {
  private _items: ReadonlyArray<CommonStatusBarItem> = [];

  constructor(items?: ReadonlyArray<CommonStatusBarItem>) {
    if (items)
      this.loadItemsInternal(items, true, false);
  }

  /** Event raised when StatusBar items are changed.
   * @internal
   */
  public readonly onItemsChanged = new BeEvent<(args: StatusBarItemsChangedArgs) => void>();

  private loadItemsInternal(items: ReadonlyArray<CommonStatusBarItem>, processConditions: boolean, sendItemChanged: boolean) {
    if (processConditions && items) {
      const eventIds = StatusBarItemsManager.getSyncIdsOfInterest(items);
      if (0 !== eventIds.length) {
        const { itemsUpdated, updatedItems } = this.internalRefreshAffectedItems(items, new Set(eventIds));

        // istanbul ignore else
        if (itemsUpdated)
          items = updatedItems;
      }
    }

    this._items = items;
    if (sendItemChanged)
      this.onItemsChanged.raiseEvent({ items });
  }

  /** load items but do not fire onItemsChanged
   * @internal
   */
  public loadItems(items: ReadonlyArray<CommonStatusBarItem>) {
    this.loadItemsInternal(items, true, false);
  }

  /** Get an array of the StatusBar items  */
  public get items(): ReadonlyArray<CommonStatusBarItem> {
    return this._items;
  }

  public set items(items: ReadonlyArray<CommonStatusBarItem>) {
    // istanbul ignore else
    if (items !== this._items)
      this.loadItemsInternal(items, true, true);
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

  /** Remove StatusBar items based on id */
  public remove(itemIdOrItemIds: StatusBarItemId | ReadonlyArray<StatusBarItemId
  >) {
    const items = this._items.filter((item) => {
      return isInstance(itemIdOrItemIds) ? item.id !== itemIdOrItemIds : !itemIdOrItemIds.find((itemId) => itemId === item.id);
    });
    this.items = items;
  }

  /** @internal */
  public removeAll() {
    this._items = [];
  }

  public static getSyncIdsOfInterest(items: readonly CommonStatusBarItem[]): string[] {
    const eventIds = new Set<string>();
    items.forEach((item) => {
      for (const [, entry] of Object.entries(item)) {
        if (entry instanceof ConditionalBooleanValue) {
          entry.syncEventIds.forEach((eventId: string) => eventIds.add(eventId.toLowerCase()));
        } else /* istanbul ignore else */ if (entry instanceof ConditionalStringValue) {
          entry.syncEventIds.forEach((eventId: string) => eventIds.add(eventId.toLowerCase()));
        }
      }
    });
    return [...eventIds.values()];
  }

  private internalRefreshAffectedItems(items: readonly CommonStatusBarItem[], eventIds: Set<string>): { itemsUpdated: boolean, updatedItems: CommonStatusBarItem[] } {
    // istanbul ignore next
    if (0 === eventIds.size)
      return { itemsUpdated: false, updatedItems: [] };

    let updateRequired = false;

    const newItems: CommonStatusBarItem[] = [];
    for (const item of items) {
      const updatedItem = { ...item };

      for (const [, entry] of Object.entries(updatedItem)) {
        if (entry instanceof ConditionalBooleanValue) {
          // istanbul ignore else
          if (ConditionalBooleanValue.refreshValue(entry, eventIds))
            updateRequired = true;
        } else /* istanbul ignore else */ if (entry instanceof ConditionalStringValue) {
          // istanbul ignore else
          if (ConditionalStringValue.refreshValue(entry, eventIds))
            updateRequired = true;
        }
      }

      newItems.push(updatedItem);
    }

    return { itemsUpdated: updateRequired, updatedItems: newItems };
  }

  public refreshAffectedItems(eventIds: Set<string>) {
    // istanbul ignore next
    if (0 === eventIds.size)
      return;

    const { itemsUpdated, updatedItems } = this.internalRefreshAffectedItems(this.items, eventIds);

    // istanbul ignore else
    if (itemsUpdated)
      this.loadItemsInternal(updatedItems, false, true);
  }
}
