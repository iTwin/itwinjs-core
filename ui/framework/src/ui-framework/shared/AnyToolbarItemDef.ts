/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import { CustomItemDef } from "./CustomItemDef";
import { AnyItemDef } from "./AnyItemDef";

/** Union of all Item definitions that can be specified in a Toolbar
 * @public
 */
export type AnyToolbarItemDef = AnyItemDef | CustomItemDef;
