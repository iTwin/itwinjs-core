/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import type { BadgeType } from "../items/BadgeType";
import type { ConditionalBooleanValue } from "../items/ConditionalBooleanValue";
import type { ConditionalStringValue } from "../items/ConditionalStringValue";
import type { ProvidedItem } from "../items/ProvidedItem";

/** Used to specify the item type added to the backstage menu.
 * @public
 */
export enum BackstageItemType {
  /** Item that executes an action function */
  ActionItem = 1,
  /** Item that activate a stage. */
  StageLauncher = 2,
}

/** Describes the data needed to insert a button into the backstage menu.
 * @public
 */
export interface CommonBackstageItem extends ProvidedItem {
  /** can be used by application to store miscellaneous data. */
  applicationData?: any;
  /** Describes badge. Renders no badge if not specified. */
  readonly badgeType?: BadgeType;
  /** Specifies the item's grouping value. Items are sorted by group and then item priority. When
   * group priority changes a separator is inserted. It is recommended using values 10 through 100, incrementing by 10. This
   * allows extensions enough gaps to insert their own groups.
   */
  readonly groupPriority: number;
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  readonly icon?: string | ConditionalStringValue;
  /** Required unique id of the item. To ensure uniqueness it is suggested that a namespace prefix of the extension name be used. */
  readonly id: string;
  /** optional data to be used by item implementor. */
  readonly internalData?: Map<string, any>;
  /** Describes if the item is visible or hidden. The default is for the item to be visible. */
  readonly isHidden?: boolean | ConditionalBooleanValue;
  /** Describes if the item is enabled or disabled. The default is for the item to be enabled. */
  readonly isDisabled?: boolean | ConditionalBooleanValue;
  /** Priority within a group (recommend using values 1 through 100). */
  readonly itemPriority: number;
  /** Label. */
  readonly label: string | ConditionalStringValue;
  /** Subtitle. */
  readonly subtitle?: string | ConditionalStringValue;
  /** Tooltip. */
  readonly tooltip?: string | ConditionalStringValue;
  /** Describes if the item is active. The default is for the item to be active if stageId matches activeFrontstageId */
  readonly isActive?: boolean | ConditionalBooleanValue;
}

/** Describes the data needed to insert an action button into the backstage menu.
 * @public
 */
export interface BackstageActionItem extends CommonBackstageItem {
  readonly execute: () => void;
}

/** Describes the data needed to insert an action button into the backstage menu.
 * @public
 */
export interface BackstageStageLauncher extends CommonBackstageItem {
  readonly stageId: string;
}

/** Describes the data needed to insert a button into the backstage menu.
 * @public
 */
export type BackstageItem = BackstageActionItem | BackstageStageLauncher;

/** BackstageActionItem type guard.
 * @public
 */
export const isActionItem = (item: BackstageItem): item is BackstageActionItem => {
  return (item as BackstageActionItem).execute !== undefined;
};

/** BackstageStageLauncher type guard.
 * @public
 */
export const isStageLauncher = (item: BackstageItem): item is BackstageStageLauncher => {
  return (item as BackstageStageLauncher).stageId !== undefined;
};

/** Utilities for creating and maintaining backstage items
 * @public
 */
export class BackstageItemUtilities {
  /** Creates a stage launcher backstage item */
  public static createStageLauncher = (
    frontstageId: string, groupPriority: number, itemPriority: number, label: string | ConditionalStringValue,
    subtitle?: string | ConditionalStringValue, icon?: string | ConditionalStringValue, overrides?: Partial<BackstageStageLauncher>
  ): BackstageStageLauncher => ({
    groupPriority,
    icon,
    id: frontstageId,
    itemPriority,
    label,
    stageId: frontstageId,
    subtitle,
    ...overrides,
  });

  /** Creates an action backstage item */
  public static createActionItem = (
    itemId: string, groupPriority: number, itemPriority: number, execute: () => void, label: string | ConditionalStringValue,
    subtitle?: string | ConditionalStringValue, icon?: string | ConditionalStringValue, overrides?: Partial<BackstageActionItem>
  ): BackstageActionItem => ({
    execute,
    groupPriority,
    icon,
    id: itemId,
    itemPriority,
    label,
    subtitle,
    ...overrides,
  });
}
