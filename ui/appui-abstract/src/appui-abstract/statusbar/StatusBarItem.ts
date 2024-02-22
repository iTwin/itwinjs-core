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
 * @deprecated in 3.6. Use [StatusBarSection]($appui-react) instead.
 * @public
 */
export enum StatusBarSection {
  /** area for tool assistance and messages */
  Message = 0,
  /** area for tool assistance and messages */
  Left = 0,  // eslint-disable-line @typescript-eslint/no-duplicate-enum-values
  /** items specific to stage/task */
  Stage = 1,
  /** items specific to stage/task */
  Center = 1,  // eslint-disable-line @typescript-eslint/no-duplicate-enum-values
  /** Select scope and selection info */
  Selection = 2,
  /** Select scope and selection info */
  Right = 2,  // eslint-disable-line @typescript-eslint/no-duplicate-enum-values
  /** items that only show based on context */
  Context = 3,
}

/** Defines which side of Icon where label is placed
 * @deprecated in 3.6. Use [StatusBarLabelSide]($appui-react) instead.
 * @public
 */
export enum StatusBarLabelSide {
  /** Label is placed left side of icon. This is the default if not specified */
  Left,
  /** Label is placed on right side of icon. */
  Right,
}

/** Type for StatusBar Item Id
 * @deprecated in 3.6. Please use `CommonStatusBarItem["id"]` from @itwin/appui-react.
 * @public
 */
export type StatusBarItemId = CommonStatusBarItem["id"]; // eslint-disable-line deprecation/deprecation

/** Describes the data needed to insert a button into the status bar.
 * @deprecated in 3.6. Use [CommonStatusBarItem]($appui-react) instead.
 * @public
 */
export interface AbstractStatusBarItem extends ProvidedItem { // eslint-disable-line deprecation/deprecation
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
  readonly section: StatusBarSection; // eslint-disable-line deprecation/deprecation
}

/** Describes the data needed to insert an action item into the status bar.
 * @deprecated in 3.6. Use [StatusBarActionItem]($appui-react) instead.
 * @public
 */
export interface AbstractStatusBarActionItem extends AbstractStatusBarItem { // eslint-disable-line deprecation/deprecation
  /** method to execute when icon is pressed */
  readonly execute: () => void;
  /** Name of icon WebFont entry or if specifying an imported SVG symbol use "webSvg:" prefix  to imported symbol Id. */
  readonly icon?: string | ConditionalStringValue;
  /** Label. */
  readonly label?: string | ConditionalStringValue;
  /** tooltip. */
  readonly tooltip?: string | ConditionalStringValue;
}

/** Describes the data needed to insert a label item with an optional icon into the status bar.
 * @deprecated in 3.6. Use [StatusBarLabelItem]($appui-react) instead.
 * @public
 */
export interface AbstractStatusBarLabelItem extends AbstractStatusBarItem { // eslint-disable-line deprecation/deprecation
  /** Name of icon WebFont entry or if specifying an imported SVG symbol use "webSvg:" prefix  to imported symbol Id. */
  readonly icon?: string | ConditionalStringValue;
  /** Label. */
  readonly label: string | ConditionalStringValue;
  /** Defines which side of icon to display label if icon is defined. */
  readonly labelSide?: StatusBarLabelSide; // eslint-disable-line deprecation/deprecation
}

/** Describes the data needed to insert a custom item into the status bar. This is used to allow extension
 *  implementer to create a framework specific component.
 * @deprecated in 3.6. Use [StatusBarCustomItem]($appui-react) instead.
 * @public
 */
export interface AbstractStatusBarCustomItem extends AbstractStatusBarItem { // eslint-disable-line deprecation/deprecation
  readonly isCustom: true;
}

/** Describes the data needed to insert a button into the status bar.
 * @deprecated in 3.6. Use [StatusBarItem]($appui-react) instead.
 * @public
 */
export type CommonStatusBarItem = AbstractStatusBarActionItem | AbstractStatusBarLabelItem | AbstractStatusBarCustomItem; // eslint-disable-line deprecation/deprecation

/** AbstractStatusBarActionItem type guard.
 * @deprecated in 3.6. Use [isStatusBarActionItem]($appui-react) instead.
 * @public
 */
export const isAbstractStatusBarActionItem = (item: CommonStatusBarItem): item is AbstractStatusBarActionItem => { // eslint-disable-line deprecation/deprecation
  return (item as AbstractStatusBarActionItem).execute !== undefined; // eslint-disable-line deprecation/deprecation
};

/** AbstractStatusBarLabelItem type guard.
 * @deprecated in 3.6. Use [isStatusBarLabelItem]($appui-react) instead.
 * @public
 */
export const isAbstractStatusBarLabelItem = (item: CommonStatusBarItem): item is AbstractStatusBarLabelItem => { // eslint-disable-line deprecation/deprecation
  return (item as AbstractStatusBarLabelItem).label !== undefined && (item as AbstractStatusBarActionItem).execute === undefined; // eslint-disable-line deprecation/deprecation
};

/** AbstractStatusBarCustomItem type guard.
 * @deprecated in 3.6. Use [isStatusBarCustomItem]($appui-react) instead.
 * @public
 */
export const isAbstractStatusBarCustomItem = (item: CommonStatusBarItem): item is AbstractStatusBarCustomItem => { // eslint-disable-line deprecation/deprecation
  return !!(item as AbstractStatusBarCustomItem).isCustom; // eslint-disable-line deprecation/deprecation
};

/** Helper class to create Abstract StatusBar Item definitions.
 * @deprecated in 3.6. Use [StatusBarItemUtilities]($appui-react) instead.
 * @public
 */
export class AbstractStatusBarItemUtilities {
  /** Creates a StatusBar item to perform an action */
  public static createActionItem = (id: string, section: StatusBarSection, itemPriority: number, icon: string | ConditionalStringValue, tooltip: string | ConditionalStringValue, execute: () => void, overrides?: Partial<AbstractStatusBarCustomItem>): AbstractStatusBarActionItem => ({ // eslint-disable-line deprecation/deprecation
    id, section, itemPriority,
    icon, tooltip,
    execute,
    ...overrides,
  });

  /** Creates a StatusBar item to display a label */
  public static createLabelItem = (id: string, section: StatusBarSection, itemPriority: number, icon: string | ConditionalStringValue, label: string | ConditionalStringValue, labelSide = StatusBarLabelSide.Right, overrides?: Partial<AbstractStatusBarLabelItem>): AbstractStatusBarLabelItem => ({ // eslint-disable-line deprecation/deprecation
    id, section, itemPriority,
    icon, label,
    labelSide,
    ...overrides,
  });
}
