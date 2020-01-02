/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { GroupItemDef } from "../toolbar/GroupItem";
import { ToolItemDef } from "./ToolItemDef";
import { CommandItemDef } from "./CommandItemDef";
import { ActionButtonItemDef } from "./ActionButtonItemDef";

/** Union of all Item definitions that can be specified in a GroupItem
 * @public
 */
export type AnyItemDef = GroupItemDef | CommandItemDef | ToolItemDef | ActionButtonItemDef;
