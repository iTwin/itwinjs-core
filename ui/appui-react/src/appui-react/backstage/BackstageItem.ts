/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import {
  isActionItem,
  isStageLauncher,
  BackstageActionItem as UIA_BackstageActionItem,
  BackstageItem as UIA_BackstageItem,
  BackstageStageLauncher as UIA_BackstageStageLauncher,
  CommonBackstageItem as UIA_CommonBackstageItem,
} from "@itwin/appui-abstract";

/** Used to specify the item type added to the backstage menu.
 * @deprecated Use type guards instead.
 * @beta
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
export type CommonBackstageItem = UIA_CommonBackstageItem;

/** Describes the data needed to insert an action button into the backstage menu.
 * @public
 */
export interface BackstageActionItem extends UIA_BackstageActionItem {
  /** @deprecated Use type guards instead. */
  readonly type: BackstageItemType.ActionItem; // eslint-disable-line deprecation/deprecation
}

/** Describes the data needed to insert an action button into the backstage menu.
 * @public
 */
export interface BackstageStageLauncher extends UIA_BackstageStageLauncher {
  /** @deprecated Use type guards instead. */
  readonly type: BackstageItemType.StageLauncher; // eslint-disable-line deprecation/deprecation
}

/** Describes the data needed to insert a button into the backstage menu.
 * @public
 */
export type BackstageItem = UIA_BackstageItem;

/** BackstageActionItem type guard.
 * @public
 */
export function isBackstageActionItem(item: UIA_BackstageActionItem): item is BackstageActionItem {
  return isActionItem(item);
}

/** BackstageStageLauncher type guard.
 * @public
 */
export function isBackstageStageLauncher(item: UIA_BackstageStageLauncher): item is BackstageStageLauncher {
  return isStageLauncher(item);
}
