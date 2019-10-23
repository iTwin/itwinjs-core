/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";
import { BeEvent } from "@bentley/bentleyjs-core";
import { BadgeType } from "@bentley/ui-abstract";

/** Used to specify the item type added to the backstage menu.
 * @beta
 */
export enum BackstageItemType {
  /** Item that executes an action function */
  ActionItem = 1,
  /** Item that activate a stage. */
  StageLauncher = 2,
}

/** Describes the data needed to insert a button into the backstage menu.
 * @beta
 */
export interface CommonBackstageItem {
  /** Describes badge. Renders no badge if not specified. */
  readonly badge?: BadgeType;
  /** GroupPriority specifies the group an item is in (recommend using values 1 through 100). Items are sorted by group and then item priority. When
   * group priority changes a separator is inserted.
   */
  readonly groupPriority: number;
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  readonly icon?: string;
  /** Required unique id of the item. To ensure uniqueness it is suggested that a namespace prefix of the plugin name be used. */
  readonly id: string;
  /** Describes if the item is enabled. */
  readonly isEnabled: boolean;
  /** Describes if the item is visible. */
  readonly isVisible: boolean;
  /** Priority within a group (recommend using values 1 through 100). */
  readonly itemPriority: number;
  /** Label. */
  readonly label: string;
  /** Subtitle. */
  readonly subtitle?: string;
  /** Tooltip. */
  readonly tooltip?: string;
  /** Type of item to be inserted. */
  readonly type: BackstageItemType;
}

/** Describes the data needed to insert an action button into the backstage menu.
 * @beta
 */
export interface BackstageActionItem extends CommonBackstageItem {
  readonly type: BackstageItemType.ActionItem;
  readonly execute: () => void;
}

/** Describes the data needed to insert an action button into the backstage menu.
 * @beta
 */
export interface BackstageStageLauncher extends CommonBackstageItem {
  readonly type: BackstageItemType.StageLauncher;
  readonly stageId: string;
}

/** Describes the data needed to insert a button into the backstage menu.
 * @beta
 */
export type BackstageItem = BackstageActionItem | BackstageStageLauncher;

/** BackstageActionItem type guard.
 * @beta
 */
export const isActionItem = (item: BackstageItem): item is BackstageActionItem => {
  return item.type === BackstageItemType.ActionItem;
};

/** BackstageStageLauncher type guard.
 * @beta
 */
export const isStageLauncher = (item: BackstageItem): item is BackstageStageLauncher => {
  return item.type === BackstageItemType.StageLauncher;
};

/** Arguments of [[BackstageItemsManager.onChanged]] event.
 * @beta
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

  /** Event raised when backstage items are changed. */
  public readonly onChanged = new BeEvent<(args: BackstageItemsChangedArgs) => void>();

  public get items(): ReadonlyArray<BackstageItem> {
    return this._items;
  }

  /** @internal */
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
    const items = [
      ...this._items,
      ...isInstance(itemOrItems) ? [itemOrItems] : itemOrItems,
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

/** Hook that returns items from [[BackstageItemsManager]].
 * @beta
 */
export const useBackstageItems = (manager: BackstageItemsManager) => {
  const [items, setItems] = React.useState(manager.items);
  React.useEffect(() => {
    setItems(manager.items);
    const handleChanged = (args: BackstageItemsChangedArgs) => {
      setItems(args.items);
    };
    manager.onChanged.addListener(handleChanged);
    return () => {
      manager.onChanged.removeListener(handleChanged);
    };
  }, [manager]);
  return items;
};
