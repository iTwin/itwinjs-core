/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import {
  AbstractStatusBarActionItem,
  AbstractStatusBarCustomItem,
  AbstractStatusBarItem,
  AbstractStatusBarLabelItem,
  isAbstractStatusBarActionItem,
  isAbstractStatusBarCustomItem,
  isAbstractStatusBarLabelItem,
  CommonStatusBarItem as UIA_CommonStatusBarItem,
  StatusBarItemId as UIA_StatusBarItemId,
  StatusBarLabelSide as UIA_StatusBarLabelSide,
  StatusBarSection as UIA_StatusBarSection,
} from "@itwin/appui-abstract";

/** Status bar Groups/Sections from Left to Right
 * @beta
 */
export type StatusBarSection = UIA_StatusBarSection; // eslint-disable-line deprecation/deprecation

/** Status bar Groups/Sections from Left to Right
 * @beta
 */
export const StatusBarSection = UIA_StatusBarSection; // eslint-disable-line @typescript-eslint/no-redeclare, deprecation/deprecation

/** Defines which side of Icon where label is placed
 * @beta
 */
export type StatusBarLabelSide = UIA_StatusBarLabelSide; // eslint-disable-line deprecation/deprecation

/** Defines which side of Icon where label is placed
 * @beta
 */
export const StatusBarLabelSide = UIA_StatusBarLabelSide; // eslint-disable-line @typescript-eslint/no-redeclare, deprecation/deprecation

/** Describes the data needed to insert a button into the status bar.
 * @beta
 */
export type CommonStatusBarItem = AbstractStatusBarItem; // eslint-disable-line deprecation/deprecation

/** Describes the data needed to insert an action item into the status bar.
 * @beta
 */
export type StatusBarActionItem = AbstractStatusBarActionItem; // eslint-disable-line deprecation/deprecation

/** Describes the data needed to insert a label item with an optional icon into the status bar.
 * @beta
 */
export type StatusBarLabelItem = AbstractStatusBarLabelItem; // eslint-disable-line deprecation/deprecation

/** Describes the data needed to insert an item into the StatusBar.
 * @deprecated Use [[StatusBarCustomItem]] instead.
 * @public
 */
export interface StatusBarItem extends AbstractStatusBarCustomItem { // eslint-disable-line deprecation/deprecation
  /** React node for the StatusBar item. */
  readonly reactNode: React.ReactNode;
}

/** Describes the data needed to insert an item into the StatusBar.
 * @beta
 */
export type StatusBarCustomItem = StatusBarItem; // eslint-disable-line deprecation/deprecation

/** Describes the data needed to insert a button into the status bar.
 * @beta
 */
// eslint-disable-next-line deprecation/deprecation
export type AnyStatusBarItem = UIA_CommonStatusBarItem; // TODO: Rename to StatusBarItem.

/** StatusBarActionItem type guard.
 * @beta
 */
export function isStatusBarActionItem(item: AnyStatusBarItem): item is StatusBarActionItem {
  return isAbstractStatusBarActionItem(item); // eslint-disable-line deprecation/deprecation
}

/** StatusBarLabelItem type guard.
 * @beta
 */
export function isStatusBarLabelItem(item: AnyStatusBarItem): item is StatusBarLabelItem {
  return isAbstractStatusBarLabelItem(item); // eslint-disable-line deprecation/deprecation
}

/** StatusBarCustomItem type guard.
 * @beta
 */
export function isStatusBarCustomItem(item: AnyStatusBarItem): item is StatusBarCustomItem {
  return isStatusBarItem(item); // eslint-disable-line deprecation/deprecation
}

/** StatusBarItem type guard.
 * @deprecated Use [[isStatusBarCustomItem]] instead.
 * @public
 */
export const isStatusBarItem = (item: UIA_CommonStatusBarItem): item is StatusBarItem => { // eslint-disable-line deprecation/deprecation
  return isAbstractStatusBarCustomItem(item) && ("reactNode" in item); // eslint-disable-line deprecation/deprecation
};
