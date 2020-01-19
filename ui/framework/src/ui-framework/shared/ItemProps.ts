/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

export {
  SyncUiProps, StringGetter, LabelProps, DescriptionProps, TooltipProps, CommandHandler,
} from "@bentley/ui-abstract";
import { AbstractItemProps, CommandHandler } from "@bentley/ui-abstract";
import { Omit, IconProps } from "@bentley/ui-core";

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
