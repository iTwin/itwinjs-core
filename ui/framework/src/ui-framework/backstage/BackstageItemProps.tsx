/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import { LabelProps, DescriptionProps, TooltipProps } from "@bentley/ui-abstract";
import { IconProps, IconSpec } from "@bentley/ui-core";
import { BackstageItemUtilities } from "./BackstageItemUtilities";

/** Base properties for a [[Backstage]] item.
 * @public
 * @deprecated - use BackstageItem in bentley/ui-abstract instead
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
 *  * Deprecated - Use [[BackstageItem]($ui-abstract) in bentley/ui-abstract instead.
 * @public
 * @deprecated - use BackstageItem in bentley/ui-abstract instead
 */
export interface BackstageItemState {
  isEnabled: boolean;
  label: string;
  subtitle: string;
  tooltip: string;
  iconSpec: IconSpec;
  isActive?: boolean;
}

/** Helper method to set backstage item state from props.
 * @public
 * @deprecated - use BackstageItem in bentley/ui-abstract instead
 */
// istanbul ignore next
export const getBackstageItemStateFromProps = (props: BackstageItemProps): BackstageItemState => {
  return BackstageItemUtilities.getBackstageItemStateFromProps(props);
};
