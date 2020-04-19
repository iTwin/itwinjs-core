/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import { CommonItemProps, AbstractActionItemProps } from "./AbstractItemProps";

/** Properties for a Menu item
 * @beta
 */
export interface AbstractMenuItemProps extends CommonItemProps {
  /** The id for the menu item. */
  id: string;
  /** The item to execute when this item is invoked. Either 'item' or 'submenu' must be specified. */
  item?: AbstractActionItemProps;
  /** Nested array of item props. Either 'item' or 'submenu' must be specified. */
  submenu?: AbstractMenuItemProps[];
}
