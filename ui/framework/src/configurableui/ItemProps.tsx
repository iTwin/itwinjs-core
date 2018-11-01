/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { IconLabelProps } from "./IconLabelSupport";
import { Direction } from "@bentley/ui-ninezone/lib/utilities/Direction";
import { GroupItemDef } from "./GroupItem";
import { CommandItemDef, ToolItemDef } from "./Item";
import { BaseItemState } from "./ItemDefBase";

// -----------------------------------------------------------------------------
// ItemProps and sub-interfaces
// -----------------------------------------------------------------------------

/** Base class for Item definitions.
 */
export interface ItemProps extends IconLabelProps {
  isVisible?: boolean;        // Default - true
  isEnabled?: boolean;        // Default - true
  featureId?: string;
  applicationData?: any;
}

/** Definition for a Tool item with a tool id.
 */
export interface ToolItemProps {
  toolId: string;
  execute?: () => any;
  iconClass?: string;
  iconElement?: React.ReactNode;
  label?: string;     // this should be an override
  labelKey?: string;  // remove - label should be coming from tool
  tooltip?: string;    // this should be an override
  applicationData?: any;  // probably not needed
  isVisible?: boolean;        // Default - true
  isEnabled?: boolean;        // Default - true
  isActive?: boolean;         // Default - false
  stateFunc?: (state: Readonly<BaseItemState>) => BaseItemState;
  stateSyncIds?: string[];
  featureId?: string;
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

/** Definition for a command handler used by [[CommandItemProps]].
 */
export interface CommandHandler {
  execute: (args?: any) => any;
  parameters?: any;
}

/** Definition for a Command item.
 */
export interface CommandItemProps extends ItemProps {
  commandId?: string;
  toolId?: string;
  commandHandler?: CommandHandler;
}

/** Union of all Item properties.
 */
export type AnyItemProps = ItemProps | GroupItemProps | ToolItemProps | CommandItemProps;

/** Definition for a list of AnyItemProps.
 */
export interface ItemPropsList {
  items?: AnyItemProps[];
}
