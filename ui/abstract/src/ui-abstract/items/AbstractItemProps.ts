/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { BaseItemState } from "./BaseItemState";
import { BadgeType } from "./BadgeType";

/** Definition that allows component to register to monitor SyncUi events.
 * @beta
 */
export interface SyncUiProps {
  /** Function called to get the new items state */
  stateFunc?: (state: Readonly<BaseItemState>) => BaseItemState;
  /** Synchronize Ids to listen for */
  stateSyncIds?: string[];
}

/** Prototype for string getter function.
 * @beta
 */
export type StringGetter = () => string;

/** Properties for an icon in an item
 * @beta
 */
export interface AbstractIconProps {
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  iconSpec?: string;
}

/** Properties for a label in an item
 * @beta
 */
export interface LabelProps {
  /** if set, it is used to explicitly set the label shown by a component. */
  label?: string | StringGetter;
  /** if set, it is used to define a key that is used to look up a localized string. This value is used only if label is not explicitly set. */
  labelKey?: string;
}

/** Properties for a description in an item
 * @beta
 */
export interface DescriptionProps {
  /** if set, it is used to explicitly set the description shown by a component. */
  description?: string | StringGetter;
  /** if set, it is used to define a key that is used to look up a localized string. This value is used only if description is not explicitly set. */
  descriptionKey?: string;
}

/** Properties for a tooltip in an item
 * @beta
 */
export interface TooltipProps {
  /** used to explicitly set the tooltip shown by a component. */
  tooltip?: string | StringGetter;
  /** if set, it is used to define a key that is used to look up a localized string. This value is used only if label is not explicitly set. */
  tooltipKey?: string;
}

/** Definition that specifies properties shared between many ConfigurableUi components.
 * @beta
 */
export interface AbstractItemProps extends AbstractIconProps, LabelProps, SyncUiProps, TooltipProps, DescriptionProps {
  /** if set, component will be visible - defaults to true */
  isVisible?: boolean;
  /** if set, component will be enabled - defaults to true */
  isEnabled?: boolean;
  /** if set, component will be considered "active" an will display an "active stripe" - defaults to false */
  isActive?: boolean;
  /** if set, component will be considered selected but will NOT display an "active stripe" - defaults to false. Typically used by buttons that toggle between two states. */
  isPressed?: boolean;
  /** can be used by application to store miscellaneous data. */
  applicationData?: any;
  /** Badge to be overlaid on the item. */
  badgeType?: BadgeType;
}

/** Definition for a command handler used by [[CommandItemProps]].
 * @beta
 */
export interface CommandHandler {
  /** Function to execute */
  execute?: (args?: any) => any;
  /** Parameters passed to the function */
  parameters?: any;
  /** Function to get the parameters passed to the function */
  getCommandArgs?: () => any[];
}

/** Definition for a Tool item with a tool id.
 * @beta
 */
export interface AbstractToolItemProps extends AbstractItemProps, CommandHandler {
  /** Id of Tool item */
  toolId: string;
}

/** Definition for a Command item.
 * @beta
 */
export interface AbstractCommandItemProps extends AbstractItemProps, CommandHandler {
  /** Id of Command item */
  commandId?: string;
}
