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
  /* a model instance, should have an accompanying element */
  | `m${Id64String}`
  /* an element instance, because models must be submodeling an element, they count as elements currently */
  | `e${Id64String}`
  /* an aspect instance */
  | `a${Id64String}`
  /** a relationship entity, so a link table relationship instance */
  | `r${Id64String}`;

/** Utility functions for ConcreteEntityId which is a subset of string
 * @public
 */
export class ConcreteEntityIds {
  // for additional utilities that require runtime backend classes, see ConcreteEntityIds in `@itwin/core-backend`
  public static isModel(id: ConcreteEntityId) {
    return id[0] === "m";
  }
  public static isElement(id: ConcreteEntityId) {
    return id[0] === "e";
  }
  public static isAspect(id: ConcreteEntityId) {
    return id[0] === "a";
  }
  /**  */
  public static isRelationship(id: ConcreteEntityId) {
    return id[0] === "r";
  }
  public static toId64(id: ConcreteEntityId) {
    // FIXME: write a test looping through the enum values (turn m|e|a|r into an enum) and making sure they
    // are each 1 character
    return id.slice(1);
  }
}

/** A set of concrete entity ids, with additional functions to more literately add ids where you have the raw id and know what type it is
 * @public
 */
export class ConcreteEntityIdSet extends Set<ConcreteEntityId> {
  public addElement(id: Id64String) { this.add(`e${id}`); }
  public addModel(id: Id64String) { this.addElement(id); }
  public addAspect(id: Id64String) { this.add(`a${id}`); }
  public addRelationship(id: Id64String) { this.add(`r${id}`); }
  /** create a ConcreteEntityIdSet-like wrapper around a plain Id64Set */

  /** Wrap a set with methods from [[ConcreteEntityIdSet]] to more literately add entities where you have the raw id and know what type it is.
   * This is so transitionary consumers can still iterate over purely raw valid element ids.
   * @deprecated use [[ConcreteEntityIdSet]] instead, this exists as a transitionary measure and will be removed in the future.
   */
  public static unifyWithRawIdsSet(set: ConcreteEntityIdSet | Set<Id64String>): ConcreteEntityIdSet | RawEntityIdSet {
    if (set instanceof ConcreteEntityIdSet) return set;
    else return new RawEntityIdSet(set);
  }
}

/** A wrapper around a set of raw Id64s for interop with the deprecated API that allowed raw Id64s
 * @internal
 */
class RawEntityIdSet {
  public constructor(private _set: Set<Id64String>) {}
  public addElement(id: Id64String) { this._set.add(id); }
  public addModel(id: Id64String) { this.addElement(id); }
  public addAspect(_id: Id64String) {}
  public addRelationship(_id: Id64String) {}
}
