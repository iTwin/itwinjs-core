/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import {
  ActionButton,
  CustomButtonDefinition,
  GroupButton,
  CommonToolbarItem as UIA_CommonToolbarItem,
  ToolbarItem as UIA_ToolbarItem,
  ToolbarItemUtilities as UIA_ToolbarItemUtilities,
  ToolbarOrientation as UIA_ToolbarOrientation,
  ToolbarUsage as UIA_ToolbarUsage,
} from "@itwin/appui-abstract";

/** Used to specify the usage of the toolbar which determine the toolbar position.
 * @beta
 */
export type ToolbarUsage = UIA_ToolbarUsage; // eslint-disable-line deprecation/deprecation

/** Used to specify the usage of the toolbar which determine the toolbar position.
 * @beta
 */
export const ToolbarUsage = UIA_ToolbarUsage; // eslint-disable-line @typescript-eslint/no-redeclare, deprecation/deprecation

/** Used to specify the orientation of the toolbar.
 * @beta
 */
export type ToolbarOrientation = UIA_ToolbarOrientation; // eslint-disable-line deprecation/deprecation

/** Used to specify the orientation of the toolbar.
 * @beta
 */
export const ToolbarOrientation = UIA_ToolbarOrientation; // eslint-disable-line @typescript-eslint/no-redeclare, deprecation/deprecation

/** Describes the data needed to insert a UI items into an existing set of UI items.
 * @beta
 */
export type CommonToolbarItem = UIA_ToolbarItem; // eslint-disable-line deprecation/deprecation

/** Describes the data needed to insert an action button into a toolbar.
 * @beta
 */
export type ToolbarActionItem = ActionButton;

/** Describes the data needed to insert a group button into a toolbar.
 * @beta
 */
export type ToolbarGroupItem = GroupButton;

/** Describes the data needed to insert a custom button into a toolbar.
 * @beta
 */
export type ToolbarCustomItem = CustomButtonDefinition;

/** Any Button Type that can be inserted into a toolbar.
 * @beta
 */
export type ToolbarItem = UIA_CommonToolbarItem;

/** ToolbarActionItem type guard.
 * @beta
 */
export function isToolbarActionItem(item: ToolbarItem): item is ToolbarActionItem {
  return UIA_ToolbarItemUtilities.isActionButton(item);
}

/** ToolbarGroupItem type guard.
 * @beta
 */
export function isToolbarGroupItem(item: ToolbarItem): item is ToolbarGroupItem {
  return UIA_ToolbarItemUtilities.isGroupButton(item);
}

/** ToolbarCustomItem type guard.
 * @beta
 */
export function isToolbarCustomItem(item: ToolbarItem): item is ToolbarCustomItem {
  return UIA_ToolbarItemUtilities.isCustomDefinition(item);
}
