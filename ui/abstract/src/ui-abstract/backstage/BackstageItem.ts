/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import { BadgeType } from "../../ui-abstract";

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
  /** Type of item to be inserted. ('itemType' used to avoid conflict with 'type' in ui-framework) */
  readonly itemType: BackstageItemType;
}

/** Describes the data needed to insert an action button into the backstage menu.
 * @beta
 */
export interface BackstageActionItem extends CommonBackstageItem {
  readonly itemType: BackstageItemType.ActionItem;
  readonly execute: () => void;
}

/** Describes the data needed to insert an action button into the backstage menu.
 * @beta
 */
export interface BackstageStageLauncher extends CommonBackstageItem {
  readonly itemType: BackstageItemType.StageLauncher;
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
  return item.itemType === BackstageItemType.ActionItem;
};

/** BackstageStageLauncher type guard.
 * @beta
 */
export const isStageLauncher = (item: BackstageItem): item is BackstageStageLauncher => {
  return item.itemType === BackstageItemType.StageLauncher;
};

/** Utilities for creating and maintaining backstage items
 * @beta
 */
export class BackstageItemUtilities {
  /** Creates a stage launcher backstage item */
  public static createStageLauncher = (frontstageId: string, groupPriority: number, itemPriority: number, label: string, subtitle?: string, iconSpec?: string): BackstageStageLauncher => ({
    groupPriority,
    icon: iconSpec,
    isEnabled: true,
    isVisible: true,
    id: frontstageId,
    itemPriority,
    itemType: BackstageItemType.StageLauncher,
    label,
    stageId: frontstageId,
    subtitle,
  })

  /** Creates an action backstage item */
  public static createActionItem = (itemId: string, groupPriority: number, itemPriority: number, execute: () => void, label: string, subtitle?: string, iconSpec?: string): BackstageActionItem => ({
    execute,
    groupPriority,
    icon: iconSpec,
    isEnabled: true,
    isVisible: true,
    id: itemId,
    itemPriority,
    itemType: BackstageItemType.ActionItem,
    label,
    subtitle,
  })
}
