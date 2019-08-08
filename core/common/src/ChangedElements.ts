/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";
import { AxisAlignedBox3dProps } from "./geometry/Placement";

/** @beta */
export interface ChangedElements {
  elements: Id64String[];
  classIds: Id64String[];
  opcodes: number[];
  modelIds?: Id64String[];
}

export interface ChangedModels {
  modelIds: Id64String[];
  bboxes: AxisAlignedBox3dProps[];
}

export interface ChangeData {
  changedElements: ChangedElements;
  changedModels: ChangedModels;
}
