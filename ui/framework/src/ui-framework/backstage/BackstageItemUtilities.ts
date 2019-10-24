import { BackstageItemType, BackstageActionItem, BackstageStageLauncher } from "./BackstageItemsManager";

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

/** Utilities for creating backstage items
 * @beta
 */
export class BackstageItemUtilities {
  /** Creates a stage launcher backstage item */
  public static createStageLauncher = (frontstageId: string, groupPriority: number, itemPriority: number, label: string, subtitle?: string, iconSpec?: string, itemProps?: Partial<BackstageStageLauncher>): BackstageStageLauncher => ({
    groupPriority,
    icon: iconSpec,
    isEnabled: true,
    isVisible: true,
    id: frontstageId,
    itemPriority,
    type: BackstageItemType.StageLauncher,
    label,
    stageId: frontstageId,
    subtitle,
    ...itemProps ? itemProps : {},
  })

  /** Creates an action backstage item */
  public static createActionItem = (itemId: string, groupPriority: number, itemPriority: number, execute: () => void, label: string, subtitle?: string, iconSpec?: string, itemProps?: Partial<BackstageActionItem>): BackstageActionItem => ({
    execute,
    groupPriority,
    icon: iconSpec,
    isEnabled: true,
    isVisible: true,
    id: itemId,
    itemPriority,
    type: BackstageItemType.ActionItem,
    label,
    subtitle,
    ...itemProps ? itemProps : {},
  })
}
