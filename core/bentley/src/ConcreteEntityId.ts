/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Id64String } from "./Id";

/**
 * This id format can be used for storing a unique key for an entity in containers like `Map`.
 * Elements and non-element entities have different id sequences, they can collide with each other, but not within themselves.
 * @public
 */
export type ConcreteEntityId =
  /* an element instance, because models must be submodeling an element, they count as elements currently */
  | `e${Id64String}`
  /* an aspect instance */
  | `a${Id64String}`
  /** a relationship entity, so a link table relationship instance */
  | `r${Id64String}`;

/** A set with additional functions to more literately add entities where you have the raw id
 * @public
 */
export class ConcreteEntityIdSet extends Set<ConcreteEntityId> implements Set<string> {
  public addElement(id: Id64String) { this.add(`e${id}`); }
  public addModel(id: Id64String) { this.addElement(id); }
  public addAspect(id: Id64String) { this.add(`a${id}`); }
  public addRelationship(id: Id64String) { this.add(`r${id}`); }
}
