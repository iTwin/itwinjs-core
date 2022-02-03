/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import type { BadgeType } from "../items/BadgeType";
import type { ConditionalBooleanValue } from "../items/ConditionalBooleanValue";
import type { ConditionalStringValue } from "../items/ConditionalStringValue";
import type { ProvidedItem } from "../items/ProvidedItem";

/** Used to specify the usage of the toolbar which determine the toolbar position.
 * @public
 */
export enum ToolbarUsage {
  /** Contains tools to Create Update and Delete content - in ninezone this is in top left of content area. */
  ContentManipulation = 0,
  /** Manipulate view/camera - in ninezone this is in top right of content area. */
  ViewNavigation = 1,
}

/** Used to specify the orientation of the toolbar.
 * @public
 */
export enum ToolbarOrientation {
  /** Horizontal toolbar. */
  Horizontal = 0,
  /** Vertical toolbar. */
  Vertical = 1,
}

/** Describes the data needed to insert a UI items into an existing set of UI items.
 * @public
 */
export interface ToolbarItem extends ProvidedItem {
  /** can be used by application to store miscellaneous data. */
  readonly applicationData?: any;
  /** Describes badge. Renders no badge if not specified. */
  readonly badgeType?: BadgeType;
  /** Optional description */
  readonly description?: string | ConditionalStringValue;
  /** Require uniqueId for the item. To ensure uniqueness it is suggested that a namespace prefix of the extension name be used. */
  readonly id: string;
  /** optional data to used by item implementor. */
  readonly internalData?: Map<string, any>;
  /** Defines if the item is active (shown with an active stripe/bar). */
  readonly isActive?: boolean;
  /** Describes if the item is visible or hidden. The default is for the item to be visible. */
  readonly isHidden?: boolean | ConditionalBooleanValue;
  /** Describes if the item is enabled or disabled. The default is for the item to be enabled. */
  readonly isDisabled?: boolean | ConditionalBooleanValue;
  /** Describes if the item should appear pressed (used for displaying toggle state). This property is NOT used by Toolbars
   * constructed using the `ToolbarWithOverflow` component, which are used in AppUi 2.0 and later. For these later toolbars
   * the icon is usually changed to denote the state of a toggle.
   */
  readonly isPressed?: boolean;
  /** Specifies the item's grouping value. Items are sorted by group and then item priority. When
   * group priority changes a separator is inserted. It is recommended using values 10 through 100, incrementing by 10. This
   * allows extensions enough gaps to insert their own groups. If the value is not specified a groupPriority of 0 is used.
   */
  readonly groupPriority?: number;
  /** Priority within a toolbar or group. */
  readonly itemPriority: number;
  /** Optional parent tool group to add tool. */
  readonly parentToolGroupId?: string;
}

/** Describes the data needed to insert an action button into a toolbar.
 * @public
 */
export interface ActionButton extends ToolbarItem {
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  readonly icon: string | ConditionalStringValue;
  /** label, shown as tool tip on a button or an item label in a group. */
  readonly label: string | ConditionalStringValue;
  /** function to run when the button is pressed. */
  readonly execute: () => void;
}

/** Describes the data needed to insert a group button into a toolbar.
 * @public
 */
export interface GroupButton extends ToolbarItem {
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  readonly icon: string | ConditionalStringValue;
  /** label, shown as tool tip on group button or a group button label in a group panel. */
  readonly label: string | ConditionalStringValue;
  /** label shown as the title in at top of group panel. */
  readonly panelLabel?: string | ConditionalStringValue;
  /** children of the group */
  readonly items: ReadonlyArray<ActionButton | GroupButton>;
}

/** Describes the data needed to insert a custom button into a toolbar.
 * @public
 */
export interface CustomButtonDefinition extends ToolbarItem {
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  readonly icon?: string | ConditionalStringValue;
  /** label, shown as tool tip on group button or a group button label in a group panel. */
  readonly label?: string | ConditionalStringValue;
  /** parameter that marks data as being a custom definition. */
  readonly isCustom: true;
}

/** Any Button Type that can be inserted into a toolbar.
 * @public
 */
export type CommonToolbarItem = ActionButton | GroupButton | CustomButtonDefinition;

/** Type for Toolbar Item Id
 * @public
 */
export type ToolbarItemId = CommonToolbarItem["id"];

/** Helper class to create Abstract StatusBar Item definitions.
 * @public
 */
export class ToolbarItemUtilities {
  /** Creates an Action Button */
  public static createActionButton = (id: string, itemPriority: number, icon: string | ConditionalStringValue, label: string | ConditionalStringValue, execute: () => void, overrides?: Partial<ActionButton>): ActionButton => ({
    id, itemPriority,
    icon, label,
    execute,
    ...overrides,
  });

  /** Creates a Group button */
  public static createGroupButton = (id: string, itemPriority: number, icon: string | ConditionalStringValue, label: string | ConditionalStringValue, items: ReadonlyArray<ActionButton | GroupButton>, overrides?: Partial<GroupButton>): GroupButton => ({
    id, itemPriority,
    icon, label,
    items,
    ...overrides,
  });

  /** ActionButton type guard. */
  public static isActionButton(item: CommonToolbarItem): item is ActionButton {
    return (item as ActionButton).execute !== undefined;
  }

  /** GroupButton type guard. */
  public static isGroupButton(item: CommonToolbarItem): item is GroupButton {
    return (item as GroupButton).items !== undefined;
  }

  /** CustomButtonDefinition type guard. */
  public static isCustomDefinition(item: CommonToolbarItem): item is CustomButtonDefinition {
    return !!(item as CustomButtonDefinition).isCustom;
  }
}
