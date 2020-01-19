/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import { AbstractCommandItemProps, AbstractToolItemProps } from "./AbstractItemProps";
import { AbstractGroupItemProps } from "./AbstractGroupItemProps";

/** Union of all Item definitions that can be specified in a GroupButton or ConditionalGroup
 * @beta
 */
export type AnyItemProps = AbstractCommandItemProps | AbstractToolItemProps | AbstractGroupItemProps;
