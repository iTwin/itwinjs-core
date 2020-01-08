/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { AnyItemDef } from "./AnyItemDef";
import { ItemProps } from "./ItemProps";

/** Definition for a Conditional item that conditionally renders other items based on UiSync events.
 * @beta
 */
export interface ConditionalItemProps extends ItemProps {
  conditionalId?: string;
  items: AnyItemDef[];
}
