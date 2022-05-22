/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import { BeEvent } from "@itwin/core-bentley";
import { ConditionalBooleanValue } from "../items/ConditionalBooleanValue";
import { ConditionalStringValue } from "../items/ConditionalStringValue";
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
 * @internal
 */
export class BackstageItemsManager {
  private _items: ReadonlyArray<BackstageItem> = [];

  constructor(items?: ReadonlyArray<BackstageItem>) {
    // istanbul ignore else
    if (items)
      this.loadItemsInternal(items, true, false);
  }

  private loadItemsInternal(items: ReadonlyArray<BackstageItem>, processConditions: boolean, sendItemChanged: boolean) {
    if (processConditions && items) {
      const eventIds = BackstageItemsManager.getSyncIdsOfInterest(items);
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
  public loadItems(items: ReadonlyArray<BackstageItem>) {
    this.loadItemsInternal(items, true, false);
  }

  /** Event raised when backstage items are changed.
   * @internal
   */
  public readonly onItemsChanged = new BeEvent<(args: BackstageItemsChangedArgs) => void>();

  public get items(): ReadonlyArray<BackstageItem> {
    return this._items;
  }

  public set items(items: ReadonlyArray<BackstageItem>) {
    // istanbul ignore else
    if (items !== this._items)
      this.loadItemsInternal(items, true, true);
  }

  /** @internal */
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

  /** @internal */
  public remove(itemIdOrItemIds: BackstageItem["id"] | ReadonlyArray<BackstageItem["id"]>) {
    const items = this._items.filter((item) => {
      return isInstance(itemIdOrItemIds) ? item.id !== itemIdOrItemIds : !itemIdOrItemIds.find((itemId) => itemId === item.id);
    });
    this.items = items;
  }

  /** @internal */
  public static getSyncIdsOfInterest(items: readonly BackstageItem[]): string[] {
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

  private internalRefreshAffectedItems(items: readonly BackstageItem[], eventIds: Set<string>): { itemsUpdated: boolean, updatedItems: BackstageItem[] } {
    // istanbul ignore next
    if (0 === eventIds.size)
      return { itemsUpdated: false, updatedItems: [] };

    let updateRequired = false;

    const newItems: BackstageItem[] = [];
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
