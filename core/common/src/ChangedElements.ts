/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";
import { AxisAlignedBox3dProps } from "./geometry/Placement";

// cspell:ignore bboxes

/** @packageDocumentation
 * @module Entities
 */

/** @internal */
export enum TypeOfChange {
  Property = 0b1,
  Geometry = 0b10,
  Placement = 0b100,
  Indirect = 0b1000,
  Hidden = 0b10000,
}

/** @internal */
export interface ChangedElements {
  elements: Id64String[];
  classIds: Id64String[];
  opcodes: number[];
  type: number[];
  modelIds?: Id64String[];
  properties?: Id64String[][];
  oldChecksums?: number[][];
  newChecksums?: number[][];
  parentIds?: Id64String[];
  parentClassIds?: Id64String[];
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
