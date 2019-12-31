/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { ConditionalItemDef } from "./ConditionalItemDef";
import { CustomItemDef } from "./CustomItemDef";
import { AnyItemDef } from "./AnyItemDef";

/** Union of all Item definitions that can be specified in a Toolbar
 * @public
 */
export type AnyToolbarItemDef = AnyItemDef | ConditionalItemDef | CustomItemDef;
