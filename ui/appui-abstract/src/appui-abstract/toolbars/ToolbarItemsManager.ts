/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import { BeEvent } from "@itwin/core-bentley";
import { ConditionalBooleanValue } from "../items/ConditionalBooleanValue";
import { ConditionalStringValue } from "../items/ConditionalStringValue";
import { ActionButton, CommonToolbarItem, GroupButton, ToolbarItemId, ToolbarItemUtilities } from "./ToolbarItem";

type InstanceOrArray<T> = T | ReadonlyArray<T>;

const isInstance = <T extends any>(args: InstanceOrArray<T>): args is T => {
  return !Array.isArray(args);
};

/** Arguments of [[ToolbarItemsManager.onChanged]] event.
 * @internal
 */
export interface ToolbarItemsChangedArgs {
  readonly items: ReadonlyArray<CommonToolbarItem>;
}

/**
 * Controls status bar items.
 * @internal
 */
export class ToolbarItemsManager {
  protected _items: ReadonlyArray<CommonToolbarItem> = [];

  constructor(items?: ReadonlyArray<CommonToolbarItem>) {
    if (items)
      this.loadItemsInternal(items, true, false);
  }

  /** Event raised when Toolbar items are changed.
   * @internal
   */
  public readonly onItemsChanged = new BeEvent<(args: ToolbarItemsChangedArgs) => void>();

  private loadItemsInternal(items: ReadonlyArray<CommonToolbarItem>, processConditions: boolean, sendItemChanged: boolean) {
    if (processConditions && items) {
      const eventIds = ToolbarItemsManager.getSyncIdsOfInterest(items);
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
  public loadItems(items: ReadonlyArray<CommonToolbarItem>) {
    this.loadItemsInternal(items, true, false);
  }

  /** Get an array of the Toolbar items  */
  public get items(): ReadonlyArray<CommonToolbarItem> {
    return this._items;
  }

  public set items(items: ReadonlyArray<CommonToolbarItem>) {
    // istanbul ignore else
    if (items !== this._items)
      this.loadItemsInternal(items, true, true);
  }

  public add(itemOrItems: CommonToolbarItem | ReadonlyArray<CommonToolbarItem>) {
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

  /** Remove Toolbar items based on id */
  public remove(itemIdOrItemIds: ToolbarItemId | ReadonlyArray<ToolbarItemId
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

  private static gatherSyncIds(eventIds: Set<string>, items: readonly CommonToolbarItem[]) {
    for (const item of items) {
      for (const [, entry] of Object.entries(item)) {
        if (entry instanceof ConditionalBooleanValue) {
          entry.syncEventIds.forEach((eventId: string) => eventIds.add(eventId.toLowerCase()));
        } else /* istanbul ignore else */ if (entry instanceof ConditionalStringValue) {
          entry.syncEventIds.forEach((eventId: string) => eventIds.add(eventId.toLowerCase()));
        }
      }

      // istanbul ignore else
      if (ToolbarItemUtilities.isGroupButton(item)) {
        this.gatherSyncIds(eventIds, item.items);
      }
    }
  }

  public static getSyncIdsOfInterest(items: readonly CommonToolbarItem[]): string[] {
    const eventIds = new Set<string>();
    this.gatherSyncIds(eventIds, items);
    return [...eventIds.values()];
  }

  private static refreshChildItems(parentItem: GroupButton, eventIds: Set<string>): { childrenUpdated: boolean, childItems: ReadonlyArray<ActionButton | GroupButton> } {
    const updatedItems: Array<ActionButton | GroupButton> = [];
    let itemsUpdated = false;

    for (const item of parentItem.items) {
      const updatedItem = { ...item };

      if (ToolbarItemUtilities.isGroupButton(updatedItem)) {
        const { childrenUpdated, childItems } = this.refreshChildItems(updatedItem, eventIds);
        // istanbul ignore else
        if (childrenUpdated) {
          updatedItem.items = childItems;
          itemsUpdated = true;
        }
      }

      for (const [, entry] of Object.entries(updatedItem)) {
        if (entry instanceof ConditionalBooleanValue) {
          // istanbul ignore else
          if (ConditionalBooleanValue.refreshValue(entry, eventIds))
            itemsUpdated = true;
        } else /* istanbul ignore else */ if (entry instanceof ConditionalStringValue) {
          // istanbul ignore else
          if (ConditionalStringValue.refreshValue(entry, eventIds))
            itemsUpdated = true;
        }
      }

      updatedItems.push(updatedItem);
    }
    return { childrenUpdated: itemsUpdated, childItems: updatedItems };
  }

  private internalRefreshAffectedItems(items: readonly CommonToolbarItem[], eventIds: Set<string>): { itemsUpdated: boolean, updatedItems: CommonToolbarItem[] } {
    // istanbul ignore next
    if (0 === eventIds.size)
      return { itemsUpdated: false, updatedItems: [] };

    let updateRequired = false;

    const newItems: CommonToolbarItem[] = [];
    for (const item of items) {
      const updatedItem = { ...item };

      if (ToolbarItemUtilities.isGroupButton(updatedItem)) {
        const { childrenUpdated, childItems } = ToolbarItemsManager.refreshChildItems(updatedItem, eventIds);
        // istanbul ignore else
        if (childrenUpdated) {
          updatedItem.items = childItems;
          updateRequired = true;
        }
      }

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

  private static isActiveToolIdRefreshRequiredForChildren(children: ReadonlyArray<ActionButton | GroupButton>, toolId: string): boolean {
    for (const item of children) {
      if (ToolbarItemUtilities.isGroupButton(item)) {
        if (this.isActiveToolIdRefreshRequiredForChildren(item.items, toolId))
          return true;
      } else {
        const isActive = !!item.isActive;
        if ((isActive && item.id !== toolId) || (!isActive && item.id === toolId))
          return true;
      }
    }
    return false;
  }

  private isActiveToolIdRefreshRequired(toolId: string): boolean {
    for (const item of this.items) {
      if (ToolbarItemUtilities.isGroupButton(item)) {
        if (ToolbarItemsManager.isActiveToolIdRefreshRequiredForChildren(item.items, toolId))
          return true;
      } else {
        const isActive = !!item.isActive;
        if ((isActive && item.id !== toolId) || (!isActive && item.id === toolId))
          return true;
      }
    }

    return false;
  }

  private static refreshActiveToolIdInChildItems(parentItem: GroupButton, toolId: string): Array<ActionButton | GroupButton> {
    const newChildren: Array<ActionButton | GroupButton> = [];
    for (const item of parentItem.items) {
      const updatedItem = { ...item };

      if (ToolbarItemUtilities.isGroupButton(updatedItem)) {
        updatedItem.items = ToolbarItemsManager.refreshActiveToolIdInChildItems(updatedItem, toolId);
      }

      updatedItem.isActive = (updatedItem.id === toolId);
      newChildren.push(updatedItem);
    }
    return newChildren;
  }

  public setActiveToolId(toolId: string) {
    // first see if any updates are really necessary
    if (!this.isActiveToolIdRefreshRequired(toolId))
      return;

    const newItems: CommonToolbarItem[] = [];
    for (const item of this.items) {
      const updatedItem = { ...item };

      if (ToolbarItemUtilities.isGroupButton(updatedItem)) {
        updatedItem.items = ToolbarItemsManager.refreshActiveToolIdInChildItems(updatedItem, toolId);
      }

      updatedItem.isActive = (updatedItem.id === toolId);
      newItems.push(updatedItem);
    }

    this.items = newItems;
  }

}
