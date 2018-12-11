/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { IconProps } from "./IconComponent";
import { Direction } from "@bentley/ui-ninezone";
import { GroupItemDef } from "./GroupItem";
import { CommandItemDef, ToolItemDef } from "./Item";
import { BaseItemState } from "./ItemDefBase";

// -----------------------------------------------------------------------------
// ItemProps and sub-interfaces
// -----------------------------------------------------------------------------

/** Definition that allows component to register to monitor SyncUi events. */
export interface SyncUiProps {
  stateFunc?: (state: Readonly<BaseItemState>) => BaseItemState;
  stateSyncIds?: string[];
}

/** Definition that specify properties shared between many ConfigurableUi components.
 */
export interface ItemProps extends IconProps, SyncUiProps {
  /** if set, component will be visible - defaults to true */
  isVisible?: boolean;
  /** if set, component will be enabled - defaults to true */
  isEnabled?: boolean;
  /** if set, component will be considered "active" an will display an "active stripe" - defaults to false */
  isActive?: boolean;
  /** if set, component will be considered selected but will NOT display an "active stripe" - defaults to false. Typically used by buttons that toggle between two states. */
  isPressed?: boolean;
  /** for future use. */
  featureId?: string;
  /** if set, it is used to explicitly set the label shown by a component. */
  label?: string;
  /** if set, it is used to define a key that is used to look up a localized string. This value is used only if label is not explicitly set. */
  labelKey?: string;
  /** used to explicitly set the tooltip shown by a component. */
  tooltip?: string;
  /** if set, it is used to define a key that is used to look up a localized string. This value is used only if label is not explicitly set. */
  tooltipKey?: string;
  /** can be used by application to store miscellaneous data. */
  applicationData?: any;
}

/** Definition for a command handler used by [[CommandItemProps]].
 */
export interface CommandHandler {
  execute?: (args?: any) => any;
  parameters?: any;
  getCommandArgs?: () => any[];
}
/** Definition for a Tool item with a tool id.
 */
export interface ToolItemProps extends ItemProps, CommandHandler {
  toolId: string;
}

/** Definition for a Command item. */
export interface CommandItemProps extends ItemProps, CommandHandler {
  commandId: string;
}

/** Union of all Item definitions that can be specified in a GroupItem */
export type AnyItemDef = GroupItemDef | CommandItemDef | ToolItemDef;

/** Definition for a Group item that opens a group of items.
 */
export interface GroupButtonProps extends ItemProps {
  groupId?: string;
  items: AnyItemDef[];
  direction?: Direction;
  itemsInColumn?: number;
  renderPanel?: () => React.ReactNode;
}

/** Union of all Item properties. */
export type AnyItemProps = ItemProps | GroupButtonProps | ToolItemProps | CommandItemProps;

/** Definition for a list of AnyItemProps. */
export interface ItemPropsList {
  items?: AnyItemProps[];
}
