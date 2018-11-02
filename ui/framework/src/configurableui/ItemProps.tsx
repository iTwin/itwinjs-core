/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { IconProps } from "./IconComponent";
import { Direction } from "@bentley/ui-ninezone/lib/utilities/Direction";
import { GroupItemDef } from "./GroupItem";
import { CommandItemDef, ToolItemDef } from "./Item";
import { BaseItemState } from "./ItemDefBase";

// -----------------------------------------------------------------------------
// ItemProps and sub-interfaces
// -----------------------------------------------------------------------------

export interface SyncUiProps {
  stateFunc?: (state: Readonly<BaseItemState>) => BaseItemState;
  stateSyncIds?: string[];
}

/** Base class for Item definitions.
 */
export interface ItemProps extends IconProps, SyncUiProps {
  isVisible?: boolean;        // Default - true
  isEnabled?: boolean;        // Default - true
  isActive?: boolean;         // Default - false
  isPressed?: boolean;        // Default - false;
  featureId?: string;
  label?: string;
  labelKey?: string;
  tooltip?: string;
  tooltipKey?: string;
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
export interface GroupItemProps extends ItemProps {
  groupId?: string;
  items: AnyItemDef[];
  direction?: Direction;
  itemsInColumn?: number;
  renderPanel?: () => React.ReactNode;
}

/** Union of all Item properties. */
export type AnyItemProps = ItemProps | GroupItemProps | ToolItemProps | CommandItemProps;

/** Definition for a list of AnyItemProps. */
export interface ItemPropsList {
  items?: AnyItemProps[];
}
