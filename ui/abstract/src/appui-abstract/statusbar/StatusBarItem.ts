/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import { BadgeType } from "../items/BadgeType";
import { ConditionalBooleanValue } from "../items/ConditionalBooleanValue";
import { ConditionalStringValue } from "../items/ConditionalStringValue";
import { ProvidedItem } from "../items/ProvidedItem";

/** Status bar Groups/Sections from Left to Right
 * @public
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
  /** items that only show based on context */
  Context = 3,
}

/** Defines which side of Icon where label is placed
 * @public
 */
export enum StatusBarLabelSide {
  /** Label is placed left side of icon. This is the default if not specified */
  Left,
  /** Label is placed on right side of icon. */
  Right,
}

/** Type for StatusBar Item Id
 * @public
 */
export type StatusBarItemId = CommonStatusBarItem["id"];

/** Describes the data needed to insert a button into the status bar.
 * @public
 */
export interface AbstractStatusBarItem extends ProvidedItem {
  /** can be used by application to store miscellaneous data. */
  applicationData?: any;
  /** Describes badge. Renders no badge if not specified. */
  readonly badgeType?: BadgeType;
  /** Required unique id of the item. To ensure uniqueness it is suggested that a namespace prefix of the extension name be used. */
  readonly id: string;
  /** optional data to used by item implementor. */
  readonly internalData?: Map<string, any>;
  /** Describes if the item is visible or hidden. The default is for the item to be visible. */
  readonly isHidden?: boolean | ConditionalBooleanValue;
  /** Describes if the item is enabled or disabled. The default is for the item to be enabled. */
  readonly isDisabled?: boolean | ConditionalBooleanValue;
  /** Priority within a section (recommend using values 1 through 100). */
  readonly itemPriority: number;
  /** status bar section */
  readonly section: StatusBarSection;
}

/** Describes the data needed to insert an action item into the status bar.
 * @public
 */
export interface AbstractStatusBarActionItem extends AbstractStatusBarItem {
  /** method to execute when icon is pressed */
  readonly execute: () => void;
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  readonly icon?: string | ConditionalStringValue;
  /** Label. */
  readonly label?: string | ConditionalStringValue;
  /** tooltip. */
  readonly tooltip?: string | ConditionalStringValue;
}

/** Describes the data needed to insert a label item with an optional icon into the status bar.
 * @public
 */
export interface AbstractStatusBarLabelItem extends AbstractStatusBarItem {
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  readonly icon?: string | ConditionalStringValue;
  /** Label. */
  readonly label: string | ConditionalStringValue;
  /** Defines which side of icon to display label if icon is defined. */
  readonly labelSide?: StatusBarLabelSide;
}

/** Describes the data needed to insert a custom item into the status bar. This is used to allow extension
 *  implementer to create a framework specific component.
 * @public
 */
export interface AbstractStatusBarCustomItem extends AbstractStatusBarItem {
  readonly isCustom: true;
}

/** Describes the data needed to insert a button into the status bar.
 * @public
 */
export type CommonStatusBarItem = AbstractStatusBarActionItem | AbstractStatusBarLabelItem | AbstractStatusBarCustomItem;

/** AbstractStatusBarActionItem type guard.
 * @public
 */
export const isAbstractStatusBarActionItem = (item: CommonStatusBarItem): item is AbstractStatusBarActionItem => {
  return (item as AbstractStatusBarActionItem).execute !== undefined;
};

/** AbstractStatusBarLabelItem type guard.
 * @public
 */
export const isAbstractStatusBarLabelItem = (item: CommonStatusBarItem): item is AbstractStatusBarLabelItem => {
  return (item as AbstractStatusBarLabelItem).label !== undefined && (item as AbstractStatusBarActionItem).execute === undefined;
};

/** AbstractStatusBarCustomItem type guard.
 * @public
 */
export const isAbstractStatusBarCustomItem = (item: CommonStatusBarItem): item is AbstractStatusBarCustomItem => {
  return !!(item as AbstractStatusBarCustomItem).isCustom;
};

/** Helper class to create Abstract StatusBar Item definitions.
 * @public
 */
export class AbstractStatusBarItemUtilities {
  /** Creates a StatusBar item to perform an action */
  public static createActionItem = (id: string, section: StatusBarSection, itemPriority: number, icon: string | ConditionalStringValue, tooltip: string | ConditionalStringValue, execute: () => void, overrides?: Partial<AbstractStatusBarCustomItem>): AbstractStatusBarActionItem => ({
    id, section, itemPriority,
    icon, tooltip,
    execute,
    ...overrides,
  });

  /** Creates a StatusBar item to display a label */
  public static createLabelItem = (id: string, section: StatusBarSection, itemPriority: number, icon: string | ConditionalStringValue, label: string | ConditionalStringValue, labelSide = StatusBarLabelSide.Right, overrides?: Partial<AbstractStatusBarLabelItem>): AbstractStatusBarLabelItem => ({
    id, section, itemPriority,
    icon, label,
    labelSide,
    ...overrides,
  });
}
