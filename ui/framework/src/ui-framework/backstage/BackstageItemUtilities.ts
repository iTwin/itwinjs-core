/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import { PropsHelper } from "../utils/PropsHelper";
import { BackstageItemType, BackstageActionItem, BackstageStageLauncher } from "./BackstageItemsManager";
import { BackstageItemProps, BackstageItemState } from "./BackstageItem";

/** Utilities for creating and maintaining backstage items
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
