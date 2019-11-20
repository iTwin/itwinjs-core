/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
