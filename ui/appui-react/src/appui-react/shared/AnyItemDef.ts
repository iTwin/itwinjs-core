/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import { GroupItemDef } from "../toolbar/GroupItem";
import { ActionButtonItemDef } from "./ActionButtonItemDef";
import { CommandItemDef } from "./CommandItemDef";
import { ToolItemDef } from "./ToolItemDef";

/** Union of all Item definitions that can be specified in a GroupItem
 * @public
 */
export type AnyItemDef = GroupItemDef | CommandItemDef | ToolItemDef | ActionButtonItemDef;
