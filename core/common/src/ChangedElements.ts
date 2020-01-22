/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";
import { AxisAlignedBox3dProps } from "./geometry/Placement";

/** @packageDocumentation
 * @module Entities
 */

/** @internal */
export interface ChangedElements {
  elements: Id64String[];
  classIds: Id64String[];
  opcodes: number[];
  modelIds?: Id64String[];
}

/** @internal */
export interface ChangedModels {
  modelIds: Id64String[];
  bboxes: AxisAlignedBox3dProps[];
}

/** @internal */
export interface ChangeData {
  changedElements: ChangedElements;
  changedModels: ChangedModels;
}
