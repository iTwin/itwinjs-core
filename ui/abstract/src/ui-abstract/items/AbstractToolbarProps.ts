/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { AbstractItemProps } from "./AbstractItemProps";
import { AnyItemProps } from "./AnyItemProps";
import { AbstractConditionalItemProps } from "./AbstractConditionalItemProps";

/** Union of all Item definitions that can be specified in a GroupButton or ConditionalGroup
 * @beta
 */
export type AnyToolbarItemProps = AnyItemProps | AbstractConditionalItemProps;

/** Definition for a Toolbar.
 * @beta
 */
export interface AbstractToolbarProps extends AbstractItemProps {
  /** Id of Toolbar */
  toolbarId?: string;
  /** Items shown in the Toolbar */
  items: AnyToolbarItemProps[];
}
