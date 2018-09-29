/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { IconLabelProps } from "./IconLabelSupport";
import { Direction } from "@bentley/ui-ninezone/lib/utilities/Direction";
import { GroupItemDef } from "./GroupItem";
import { ToolItemDef, CommandItemDef } from "./Item";

// -----------------------------------------------------------------------------
// ItemProps and sub-interfaces
// -----------------------------------------------------------------------------

/** Base class for Item definitions.
 */
export interface ItemProps extends IconLabelProps {
  isVisible?: boolean;        // Default - true
  isVisibleExpr?: string;
  isEnabled?: boolean;        // Default - true
  isEnabledExpr?: string;
  featureId?: string;
  itemSyncMsg?: string;
  applicationData?: any;
}

/** Definition for a Tool item with a tool id.
 */
export interface ToolItemProps extends ItemProps {
  toolId: string;
  execute?: () => any;
}

/** Union of all Item definitions */
export type AnyItemDef = string | GroupItemDef | ToolItemDef | CommandItemDef;

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
  commandId: string;
  commandHandler: CommandHandler;
}

/** Union of all Item properties.
 */
export type AnyItemProps = ItemProps | GroupItemProps | ToolItemProps | CommandItemProps;

/** Definition for a list of AnyItemProps.
 */
export interface ItemPropsList {
  items?: AnyItemProps[];
}
