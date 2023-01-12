/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import { PropsHelper } from "../utils/PropsHelper";
import { BackstageActionItem, BackstageItemType, BackstageStageLauncher } from "./BackstageItem";
import { BackstageItemProps, BackstageItemState } from "./BackstageItemProps";

/** Utilities for creating and maintaining backstage items
 * @beta
 */
export class BackstageItemUtilities {
  /** Creates a stage launcher backstage item. */
  public static createStageLauncher = (frontstageId: string, groupPriority: number, itemPriority: number, label: string, subtitle?: string, iconSpec?: string, overrides?: Partial<BackstageStageLauncher>): BackstageStageLauncher => ({
    groupPriority,
    icon: iconSpec,
    id: frontstageId,
    itemPriority,
    type: BackstageItemType.StageLauncher, // eslint-disable-line deprecation/deprecation
    label,
    stageId: frontstageId,
    subtitle,
    ...overrides,
  });

  /** Creates an action backstage item. */
  public static createActionItem = (itemId: string, groupPriority: number, itemPriority: number, execute: () => void, label: string, subtitle?: string, iconSpec?: string, overrides?: Partial<BackstageActionItem>): BackstageActionItem => ({
    execute,
    groupPriority,
    icon: iconSpec,
    id: itemId,
    itemPriority,
    type: BackstageItemType.ActionItem, // eslint-disable-line deprecation/deprecation
    label,
    subtitle,
    ...overrides,
  });

  /** Helper method to set backstage item state from props.
   * @deprecated
   */
  public static getBackstageItemStateFromProps = (props: BackstageItemProps): BackstageItemState => { // eslint-disable-line deprecation/deprecation
    const labelSpec = PropsHelper.getStringSpec(props.label, props.labelKey);
    const subtitleSpec = PropsHelper.getStringSpec(props.description, props.descriptionKey);
    const tooltipSpec = PropsHelper.getStringSpec(props.tooltip, props.tooltipKey);

    return {
      isEnabled: undefined !== props.isEnabled ? props.isEnabled : /* istanbul ignore next */false,
      label: PropsHelper.getStringFromSpec(labelSpec),
      subtitle: PropsHelper.getStringFromSpec(subtitleSpec),
      tooltip: PropsHelper.getStringFromSpec(tooltipSpec),
      iconSpec: props.iconSpec,
      isActive: undefined !== props.isActive ? props.isActive : false,
    };
  };
}
