/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { AbstractItemProps } from "./AbstractItemProps";
import { AnyItemProps } from "./AnyItemProps";

/** Definition for a group of items that conditionally render based on UiSync events.
 * @beta
 */
export interface AbstractConditionalItemProps extends AbstractItemProps {
  conditionalId?: string;
  items: AnyItemProps[];
}
