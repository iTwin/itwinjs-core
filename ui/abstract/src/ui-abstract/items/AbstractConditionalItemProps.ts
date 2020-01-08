/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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
