/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * @packageDocumentation
 * @module Entities
 */
import type { DbOpcode, Id64String } from "@itwin/core-bentley";
import type { AxisAlignedBox3dProps } from "./geometry/Placement";

// cspell:ignore bboxes

/** Bitflags describing which aspects of an [Element]($backend) changed as part of a [[ChangedElements]].
 * @public
 */
export enum TypeOfChange {
  /** A property in the element changed */
  Property = 0b1,
  /** The geometry stream of a [GeometricElement]($backend) changed */
  Geometry = 0b10,
  /** The [[Placement]] of a [GeometricElement]($backend) changed */
  Placement = 0b100,
  /** Indirect change occurred to this element by a related instance */
  Indirect = 0b1000,
  /** Hidden properties of the element changed */
  Hidden = 0b10000,
}

/** Changed elements found in a changeset or between a range of changesets.
 * All arrays in this object will have the same number of items.
 * Each index for those arrays refer to the same element, e.g. to get the class Id of
 * the element given by element Id changedElements.elements[index], you can use changedElements.classIds[index].
 * @public
 */
export interface ChangedElements {
  /** Ids of elements that changed */
  elements: Id64String[];
  /** ECClass Ids of elements that changed */
  classIds: Id64String[];
  /** Operation that occurred on the element. Whether the element was inserted, updated or deleted.
   * See [DbOpcode]($core-bentley)
   */
  opcodes: DbOpcode[];
  /** Type of change bitflags, see [[TypeOfChange]] */
  type: TypeOfChange[];
  /** Model Ids of the changed elements
   * This may be undefined if the agent that did the processing job did not export model Ids
   */
  modelIds?: Id64String[];
  /** Property accessor strings of properties that changed, if any, for each changed element
   * This may be undefined if the agent that did the processing job did not export properties
  */
  properties?: string[][];
  /** Before state checksums of the property value
   * Useful to determine if property values have changed
   * between the versions being inspected
   * This may be undefined if the agent that did the processing job did not export checksums
   */
  oldChecksums?: number[][];
  /** After state checksums of the property value
   * Useful to determine if property values have changed
   * between the versions being inspected
   * This may be undefined if the agent that did the processing job did not export checksums
   */
  newChecksums?: number[][];
  /**
   * Parent ids of the changed elements
   * Will be "0" if the element has no parent
   * This may be undefined if the agent that did the processing job did not export parent information
   */
  parentIds?: Id64String[];
  /**
   * Parent ECClass Ids of the changed elements
   * Will be "0" if the element has no parent
   * This may be undefined if the agent that did the processing job did not export parent information
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
