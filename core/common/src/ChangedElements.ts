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

/** Type of change bitflags that show what changed on an element
 * @public
 */
export enum TypeOfChange {
  /** A property in the element changed */
  Property = 0b1,
  /** The geometry stream of a geometric element changed */
  Geometry = 0b10,
  /** The placement of a geometric element changed */
  Placement = 0b100,
  /** Indirect change occurred to this element by a related instance */
  Indirect = 0b1000,
  /** Hidden properties of the element changed */
  Hidden = 0b10000,
}

/** Changed elements found in a changeset or between a range of changesets
 * @public
 */
export interface ChangedElements {
  /** Ids of elements that changed */
  elements: Id64String[];
  /** ECClassIds of elements that changed */
  classIds: Id64String[];
  /** Operation codes, see [[DbOpcode]] */
  opcodes: number[];
  /** Type of change bitflags, see [[TypeOfChange]] */
  type: number[];
  /** Model Ids of the changed elements */
  modelIds?: Id64String[];
  /** Properties that changed, if any, of each changed element */
  properties?: Id64String[][];
  /** Before state checksums of the property value
   * Useful to determine if property values have changed
   * between the versions being inspected
   */
  oldChecksums?: number[][];
  /** After state checksums of the property value
   * Useful to determine if property values have changed
   * between the versions being inspected
   */
  newChecksums?: number[][];
  /**
   * Parent ids of the changed elements
   * Will be "0" if the element has no parent
   */
  parentIds?: Id64String[];
  /**
   * Parent [[ECClass]] ids of the changed elements
   * Will be "0" if the element has no parent
   */
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
