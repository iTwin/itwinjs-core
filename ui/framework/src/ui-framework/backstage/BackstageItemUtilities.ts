/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import { PropsHelper } from "../utils/PropsHelper";
import { BackstageItemType as UIA_BackstageItemType, BackstageActionItem as UIA_BackstageActionItem, BackstageStageLauncher as UIA_BackstageStageLauncher } from "@bentley/ui-abstract";
import { BackstageItemProps, BackstageItemState } from "./BackstageItemProps";

/** Used to specify the item type added to the backstage menu.
 * Deprecated - Use [BackstageItemType]($ui-abstract) in bentley/ui-abstract instead.
 * @beta @deprecated Use BackstageItemType in bentley/ui-abstract instead
 */
export enum BackstageItemType {
  /** Item that executes an action function */
  ActionItem = 1,
  /** Item that activate a stage. */
  StageLauncher = 2,
}

/** Describes the data needed to insert an action button into the backstage menu.
 * Deprecated - Use [BackstageActionItem]($ui-abstract) in bentley/ui-abstract instead.
 * @beta @deprecated Use BackstageActionItem in bentley/ui-abstract instead
 */
export interface BackstageActionItem extends UIA_BackstageActionItem {
  readonly type: BackstageItemType.ActionItem;
}

/** Describes the data needed to insert an action button into the backstage menu.
 * Deprecated - Use [BackstageStageLauncher]($ui-abstract) in bentley/ui-abstract instead.
 * @beta @deprecated Use BackstageStageLauncher in bentley/ui-abstract instead
 */
export interface BackstageStageLauncher extends UIA_BackstageStageLauncher {
  readonly type: BackstageItemType.StageLauncher;
}

/** Utilities for creating and maintaining backstage items
 * @beta
 */
export class BackstageItemUtilities {
  /** Creates a stage launcher backstage item
   * @beta @deprecated Use BackstageItemUtilities.createStageLauncher in bentley/ui-abstract instead
   */
  public static createStageLauncher = (frontstageId: string, groupPriority: number, itemPriority: number, label: string, subtitle?: string, iconSpec?: string, itemProps?: Partial<BackstageStageLauncher>): BackstageStageLauncher => ({
    groupPriority,
    icon: iconSpec,
    isEnabled: true,
    isVisible: true,
    id: frontstageId,
    itemPriority,
    type: BackstageItemType.StageLauncher,
    itemType: UIA_BackstageItemType.StageLauncher,
    label,
    stageId: frontstageId,
    subtitle,
    ...itemProps ? itemProps : {},
  })

  /** Creates an action backstage item
   * @beta @deprecated Use BackstageItemUtilities.createActionItem in bentley/ui-abstract instead
   */
  public static createActionItem = (itemId: string, groupPriority: number, itemPriority: number, execute: () => void, label: string, subtitle?: string, iconSpec?: string, itemProps?: Partial<BackstageActionItem>): BackstageActionItem => ({
    execute,
    groupPriority,
    icon: iconSpec,
    isEnabled: true,
    isVisible: true,
    id: itemId,
    itemPriority,
    type: BackstageItemType.ActionItem,
    itemType: UIA_BackstageItemType.ActionItem,
    label,
    subtitle,
    ...itemProps ? itemProps : {},
  })

  /** Helper method to set backstage item state from props */
  public static getBackstageItemStateFromProps = (props: BackstageItemProps): BackstageItemState => {
    const labelSpec = PropsHelper.getStringSpec(props.label, props.labelKey);
    const subtitleSpec = PropsHelper.getStringSpec(props.description, props.descriptionKey);
    const tooltipSpec = PropsHelper.getStringSpec(props.tooltip, props.tooltipKey);

    return {
      isEnabled: undefined !== props.isEnabled ? props.isEnabled : true,
      label: PropsHelper.getStringFromSpec(labelSpec),
      subtitle: PropsHelper.getStringFromSpec(subtitleSpec),
      tooltip: PropsHelper.getStringFromSpec(tooltipSpec),
      iconSpec: props.iconSpec,
      isActive: undefined !== props.isActive ? props.isActive : false,
    };
  }
}
