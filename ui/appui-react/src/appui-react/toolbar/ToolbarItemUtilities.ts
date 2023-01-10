/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import {  ToolbarItemUtilities as UIA_ToolbarItemUtilities } from "@itwin/appui-abstract";
import { ToolbarActionItem, ToolbarCustomItem, ToolbarGroupItem, ToolbarItem } from "./ToolbarItem";

/** Helper class to create Abstract StatusBar Item definitions.
 * @public
 */
export namespace ToolbarItemUtilities {
  /** Creates an Action Button */
  export function createActionItem(id: ToolbarActionItem["id"], itemPriority: ToolbarActionItem["itemPriority"], icon: ToolbarActionItem["icon"], label: ToolbarActionItem["label"], execute: ToolbarActionItem["execute"], overrides?: Partial<ToolbarActionItem>): ToolbarActionItem {
    return UIA_ToolbarItemUtilities.createActionButton(id, itemPriority, icon, label, execute, overrides);
  }

  /** Creates a Group button */
  export function createGroupItem(id: string, itemPriority: number, icon: ToolbarGroupItem["icon"], label: ToolbarGroupItem["label"], items: ToolbarGroupItem["items"], overrides?: Partial<ToolbarGroupItem>): ToolbarGroupItem {
    return UIA_ToolbarItemUtilities.createGroupButton(id, itemPriority, icon, label, items, overrides);
  }

  /** ToolbarActionItem type guard. */
  export function isActionItem(item: ToolbarItem): item is ToolbarActionItem {
    return UIA_ToolbarItemUtilities.isActionButton(item);
  }

  /** ToolbarGroupItem type guard. */
  export function isGroupItem(item: ToolbarItem): item is ToolbarGroupItem {
    return UIA_ToolbarItemUtilities.isGroupButton(item);
  }

  /** ToolbarCustomItem type guard. */
  export function isCustomItem(item: ToolbarItem): item is ToolbarCustomItem {
    return UIA_ToolbarItemUtilities.isActionButton(item);
  }
}
