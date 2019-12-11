/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import {
  SyncUiProps, StringGetter, LabelProps, DescriptionProps, TooltipProps, CommandHandler,
  AbstractItemProps,
} from "@bentley/ui-abstract";
import { Omit, IconProps } from "@bentley/ui-core";

/** Definition that allows a component to register to monitor SyncUi events.
 * Deprecated - Use [SyncUiProps]($ui-abstract) in bentley/ui-abstract instead.
 * @public
 * @deprecated - use SyncUiProps in bentley/ui-abstract instead
 */
export type SyncUiProps = SyncUiProps;

/** Prototype for string getter function.
 * Deprecated - Use [StringGetter]($ui-abstract) in bentley/ui-abstract instead.
 * @public
 * @deprecated - use StringGetter in bentley/ui-abstract instead
 */
export type StringGetter = StringGetter;

/** Properties for a label in an item
 * Deprecated - Use [LabelProps]($ui-abstract) in bentley/ui-abstract instead.
 * @public
 * @deprecated - use LabelProps in bentley/ui-abstract instead
 */
export type LabelProps = LabelProps;

/** Properties for a description in an item
 * Deprecated - Use [DescriptionProps]($ui-abstract) in bentley/ui-abstract instead.
 * @deprecated - use DescriptionProps in bentley/ui-abstract instead
 * @public
 */
export type DescriptionProps = DescriptionProps;

/** Properties for a tooltip in an item
 * Deprecated - Use [TooltipProps]($ui-abstract) in bentley/ui-abstract instead.
 * @public
 * @deprecated - use TooltipProps in bentley/ui-abstract instead
 */
export type TooltipProps = TooltipProps;

/** Definition for a command handler used by [[CommandItemProps]].
 * Deprecated - Use [CommandHandler]($ui-abstract) in bentley/ui-abstract instead.
 * @public
 * @deprecated - use CommandHandler in bentley/ui-abstract instead
 */
export type CommandHandler = CommandHandler;

/** Definition that specifies properties shared between many ConfigurableUi components.
 * @public
 */
export interface ItemProps extends Omit<AbstractItemProps, "iconSpec">, IconProps {
  /** Indicates whether to draw a Beta badge.
   * @deprecated - use badgeType instead
   */
  betaBadge?: boolean;
}

/** Properties for a Tool item with a tool id.
 * @public
 */
export interface ToolItemProps extends ItemProps, CommandHandler {
  toolId: string;
}

/** Properties for a Command item.
 * @public
 */
export interface CommandItemProps extends ItemProps, CommandHandler {
  commandId?: string;
}
