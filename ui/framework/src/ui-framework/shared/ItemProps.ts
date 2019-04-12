/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { IconProps } from "./IconComponent";
import { Direction } from "@bentley/ui-ninezone";
import { GroupItemDef } from "../toolbar/GroupItem";
import { CommandItemDef, ToolItemDef } from "./Item";
import { BaseItemState } from "./ItemDefBase";

// -----------------------------------------------------------------------------
// ItemProps and sub-interfaces
// -----------------------------------------------------------------------------

/** Definition that allows component to register to monitor SyncUi events.
 * @public
 */
export interface SyncUiProps {
  stateFunc?: (state: Readonly<BaseItemState>) => BaseItemState;
  stateSyncIds?: string[];
}

/** Prototype for string getter function.
 * @public
 */
export type StringGetter = () => string;

/** Properties for a label in an item
 * @public
 */
export interface LabelProps {
  /** if set, it is used to explicitly set the label shown by a component. */
  label?: string | StringGetter;
  /** if set, it is used to define a key that is used to look up a localized string. This value is used only if label is not explicitly set. */
  labelKey?: string;
}

/** Properties for a description in an item
 * @public
 */
export interface DescriptionProps {
  /** if set, it is used to explicitly set the description shown by a component. */
  description?: string | StringGetter;
  /** if set, it is used to define a key that is used to look up a localized string. This value is used only if description is not explicitly set. */
  descriptionKey?: string;
}

/** Properties for a tooltip in an item
 * @public
 */
export interface TooltipProps {
  /** used to explicitly set the tooltip shown by a component. */
  tooltip?: string | StringGetter;
  /** if set, it is used to define a key that is used to look up a localized string. This value is used only if label is not explicitly set. */
  tooltipKey?: string;
}

/** Definition that specifies properties shared between many ConfigurableUi components.
 * @public
 */
export interface ItemProps extends IconProps, LabelProps, SyncUiProps, TooltipProps {
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
}

/** Definition for a command handler used by [[CommandItemProps]].
 * @public
 */
export interface CommandHandler {
  execute?: (args?: any) => any;
  parameters?: any;
  getCommandArgs?: () => any[];
}

/** Definition for a Tool item with a tool id.
 * @public
 */
export interface ToolItemProps extends ItemProps, CommandHandler {
  toolId: string;
}

/** Definition for a Command item.
 * @public
 */
export interface CommandItemProps extends ItemProps, CommandHandler {
  commandId?: string;
}

/** Union of all Item definitions that can be specified in a GroupItem
 * @public
 */
export type AnyItemDef = GroupItemDef | CommandItemDef | ToolItemDef;

/** Definition for a Group item that opens a group of items.
 * @public
 */
export interface GroupItemProps extends ItemProps {
  groupId?: string;
  items: AnyItemDef[];
  direction?: Direction;
  itemsInColumn?: number;
}

/** Union of all Item properties.
 * @public
 */
export type AnyItemProps = ItemProps | GroupItemProps | ToolItemProps | CommandItemProps;

/** Definition for a list of AnyItemProps.
 * @public
 */
export interface ItemPropsList {
  items?: AnyItemProps[];
}
