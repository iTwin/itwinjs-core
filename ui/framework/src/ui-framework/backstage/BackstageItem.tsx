/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import { LabelProps, DescriptionProps, TooltipProps } from "../shared/ItemProps";
import { IconProps, IconSpec } from "../shared/IconComponent";
import { PropsHelper } from "../utils/PropsHelper";

/** Base properties for a [[Backstage]] item.
 * @public
 */
export interface BackstageItemProps extends LabelProps, DescriptionProps, TooltipProps, IconProps {
  /** if set, component will be enabled - defaults to true */
  isEnabled?: boolean;
  /** if set, component will be shown with as the active item - defaults to false */
  isActive?: boolean;
  /** optional function to set state of backstage item */
  stateFunc?: (state: Readonly<BackstageItemState>) => BackstageItemState;
  /** optional SyncUi event ids that will trigger the state function to run. */
  stateSyncIds?: string[];
}

/** Properties that define the state of a Backstage items.
 * @public
 */
export interface BackstageItemState {
  isEnabled: boolean;
  label: string;
  subtitle: string;
  tooltip: string;
  iconSpec: IconSpec;
  isActive?: boolean;
}

/** Helper method to set backstage item state from props
 * @public
 */
export const getBackstageItemStateFromProps = (props: BackstageItemProps): BackstageItemState => {
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
};
