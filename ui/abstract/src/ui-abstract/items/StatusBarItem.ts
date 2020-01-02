/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { BadgeType } from "../../ui-abstract";

/** Used to specify the item type added to the status bar.
 * @beta
 */
export enum StatusBarItemType {
  /** Item that executes an action function */
  ActionItem = 1,
  /** Item that displays a label and optional icon in status bar. */
  Label,
  /** Item that provides its own custom component */
  CustomItem,
  // Opens a modal pop-up dialog
  // PopupItem
}

/** Status bar Groups/Sections from Left to Right
 * @beta
 */
export enum StatusBarSection {
  /** area for tool assistance and messages */
  Message = 0,
  /** area for tool assistance and messages */
  Left = 0,
  /** items specific to stage/task */
  Stage = 1,
  /** items specific to stage/task */
  Center = 1,
  /** Select scope and selection info */
  Selection = 2,
  /** Select scope and selection info */
  Right = 2,
  /** items that only show based on context
   * @beta
   */
  Context = 3,
}

/** Defines which side of Icon where label is placed
 * @beta
 */
export enum StatusbarLabelSide {
  /** Label is placed left side of icon. This is the default if not specified */
  Left,
  /** Label is placed on right side of icon. */
  Right,
}

/** Type for StatusBar Item Id
 * @beta
 */
export type StatusBarItemId = CommonStatusBarItem["id"];

/** Describes the data needed to insert a button into the status bar.
 * @beta
 */
export interface AbstractStatusBarItem {
  /** Describes badge. Renders no badge if not specified. */
  readonly badge?: BadgeType;
  /** Required unique id of the item. To ensure uniqueness it is suggested that a namespace prefix of the plugin name be used. */
  readonly id: string;
  /** Describes if the item is visible. */
  readonly isVisible: boolean;
  /** Priority within a section (recommend using values 1 through 100). */
  readonly itemPriority: number;
  /** status bar section */
  readonly section: StatusBarSection;
  /** Type of item to be inserted. */
  readonly type: StatusBarItemType;
}

/** Describes the data needed to insert an action item into the status bar.
 * @beta
 */
export interface AbstractStatusBarActionItem extends AbstractStatusBarItem {
  /** method to execute when icon is pressed */
  readonly execute: () => void;
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  readonly icon?: string;
  /** Label. */
  readonly label?: string;
  /** tooltip. */
  readonly tooltip?: string;
  /** Type of item to be inserted. */
  readonly type: StatusBarItemType.ActionItem;
}

/** Describes the data needed to insert a label item with an optional icon into the status bar.
 * @beta
 */
export interface AbstractStatusBarLabelItem extends AbstractStatusBarItem {
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  readonly icon?: string;
  /** Label. */
  readonly label: string;
  /** Defines which side of icon to display label if icon is defined. */
  readonly labelSide?: StatusbarLabelSide;
  /** Type of item to be inserted. */
  readonly type: StatusBarItemType.Label;
}

/** Describes the data needed to insert a custom item into the status bar. This is used to allow plugin
 *  implementer to create a framework specific component.
 * @beta
 */
export interface AbstractStatusBarCustomItem extends AbstractStatusBarItem {
  readonly type: StatusBarItemType.CustomItem;
}

/** Describes the data needed to insert a button into the status bar.
 * @beta
 */
export type CommonStatusBarItem = AbstractStatusBarActionItem | AbstractStatusBarLabelItem | AbstractStatusBarCustomItem; // | AbstractStatusBarPopupItem;

/** AbstractStatusBarActionItem type guard.
 * @beta
 */
export const isAbstractStatusBarActionItem = (item: CommonStatusBarItem): item is AbstractStatusBarActionItem => {
  return item.type === StatusBarItemType.ActionItem;
};

/** AbstractStatusBarLabelItem type guard.
 * @beta
 */
export const isAbstractStatusBarLabelItem = (item: CommonStatusBarItem): item is AbstractStatusBarLabelItem => {
  return item.type === StatusBarItemType.Label;
};

/** AbstractStatusBarCustomItem type guard.
 * @beta
 */
export const isAbstractStatusBarCustomItem = (item: CommonStatusBarItem): item is AbstractStatusBarCustomItem => {
  return item.type === StatusBarItemType.CustomItem;
};

// /** AbstractStatusBarPopupItem type guard.
//  * @beta
//  */
// export const isAbstractStatusBarPopupItem = (item: CommonStatusBarItem): item is AbstractStatusBarPopupItem => {
//   return item.type === StatusBarItemType.Popup;
// };

/** Helper class to create Abstract StatusBar Item definitions.
 * @beta
 */
export class AbstractStatusBarItemUtilities {
  /** Creates a StatusBar item to perform an action */
  public static createActionItem = (id: string, section: StatusBarSection, itemPriority: number, icon: string, tooltip: string, execute: () => void): AbstractStatusBarActionItem => ({
    id, section, itemPriority,
    icon, tooltip,
    isVisible: true,
    execute,
    type: StatusBarItemType.ActionItem,
  })

  /** Creates a StatusBar item to display a label */
  public static createLabelItem = (id: string, section: StatusBarSection, itemPriority: number, icon: string, label: string, labelSide = StatusbarLabelSide.Right): AbstractStatusBarLabelItem => ({
    id, section, itemPriority,
    icon, label,
    isVisible: true,
    type: StatusBarItemType.Label,
    labelSide,
  })
}
