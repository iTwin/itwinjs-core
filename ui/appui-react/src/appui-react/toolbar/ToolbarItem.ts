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
  ToolbarItemId as UIA_ToolbarItemId,
  ToolbarItemUtilities as UIA_ToolbarItemUtilities,
  ToolbarOrientation as UIA_ToolbarOrientation,
  ToolbarUsage as UIA_ToolbarUsage,
} from "@itwin/appui-abstract";

/** Used to specify the usage of the toolbar which determine the toolbar position.
 * @public
 */
export type ToolbarUsage = UIA_ToolbarUsage; // eslint-disable-line deprecation/deprecation

/** Used to specify the usage of the toolbar which determine the toolbar position.
 * @public
 */
export const ToolbarUsage = UIA_ToolbarUsage; // eslint-disable-line @typescript-eslint/no-redeclare, deprecation/deprecation

/** Used to specify the orientation of the toolbar.
 * @public
 */
export type ToolbarOrientation = UIA_ToolbarOrientation; // eslint-disable-line deprecation/deprecation

/** Used to specify the orientation of the toolbar.
 * @public
 */
export const ToolbarOrientation = UIA_ToolbarOrientation; // eslint-disable-line @typescript-eslint/no-redeclare, deprecation/deprecation

/** Describes the data needed to insert a UI items into an existing set of UI items.
 * @public
 */
export type CommonToolbarItem = UIA_ToolbarItem; // eslint-disable-line deprecation/deprecation

/** Describes the data needed to insert an action button into a toolbar.
 * @public
 */
export type ToolbarActionItem = ActionButton; // eslint-disable-line deprecation/deprecation

/** Describes the data needed to insert a group button into a toolbar.
 * @public
 */
export type ToolbarGroupItem = GroupButton; // eslint-disable-line deprecation/deprecation

/** Describes the data needed to insert a custom button into a toolbar.
 * @public
 */
export type ToolbarCustomItem = CustomButtonDefinition; // eslint-disable-line deprecation/deprecation

/** Any Button Type that can be inserted into a toolbar.
 * @public
 */
export type ToolbarItem = UIA_CommonToolbarItem; // eslint-disable-line deprecation/deprecation

/** Type for Toolbar Item Id
 * @public
 */
export type ToolbarItemId = UIA_ToolbarItemId; // eslint-disable-line deprecation/deprecation

/** ToolbarActionItem type guard.
 * @public
 */
export function isToolbarActionItem(item: ToolbarItem): item is ToolbarActionItem {
  return UIA_ToolbarItemUtilities.isActionButton(item); // eslint-disable-line deprecation/deprecation
}

/** ToolbarGroupItem type guard.
 * @public
 */
export function isToolbarGroupItem(item: ToolbarItem): item is ToolbarGroupItem {
  return UIA_ToolbarItemUtilities.isGroupButton(item); // eslint-disable-line deprecation/deprecation
}

/** ToolbarCustomItem type guard.
 * @public
 */
export function isToolbarCustomItem(item: ToolbarItem): item is ToolbarCustomItem {
  return UIA_ToolbarItemUtilities.isActionButton(item); // eslint-disable-line deprecation/deprecation
}
