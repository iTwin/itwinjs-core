/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Item */

import { IconLabelProps } from "./IconLabelSupport";
import { Direction } from "@bentley/ui-ninezone/lib/utilities/Direction";
import { GroupItemDef } from "./GroupItem";
import { MessageItemDef, PageItemDef, ToolItemDef, CommandItemDef } from "./Item";

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

/** Direction for a message - either to the UI thread or the Work thread.
 */
export enum MessageDirection {
  UI,
  Work,
}

/** Definition for a Message item with a message id.
 */
export interface MessageItemProps extends ItemProps {
  messageId: string;
  direction: MessageDirection;
  isActive?: boolean;        // Default - false
  isActiveExpr?: string;
  isToggle?: boolean;        // Default - false
  messageData?: string;
  messageDataExpr?: string;
  overrideMessageId?: string;
}

/** Definition for a Page item with a page id.
 */
export interface PageItemProps extends ItemProps {
  pageId: string;
  sourceFile?: string;
  isDialog?: boolean;         // Default - false;
}

/** Definition for a Tool item with a tool id.
 */
export interface ToolItemProps extends ItemProps {
  toolId: string;
  execute?: () => any;
}

/** Union of all Item definitions */
export type AnyItemDef = string | GroupItemDef | MessageItemDef | PageItemDef | ToolItemDef | CommandItemDef;

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
  messageId: string;
  parameters: any;
  execute?: () => any;
}

/** Definition for a Command item.
 */
export interface CommandItemProps extends ItemProps {
  commandId: string;
  commandHandler?: CommandHandler;
}

/** Union of all Item properties.
 */
export type AnyItemProps = ItemProps | GroupItemProps | MessageItemProps | PageItemProps | ToolItemProps | CommandItemProps;

/** Definition for a list of AnyItemProps.
 */
export interface ItemPropsList {
  items?: AnyItemProps[];
}
