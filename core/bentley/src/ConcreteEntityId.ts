/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Id64, Id64String } from "./Id";

/**
 * Types of concrete entities. Used for storing strings in JavaScript reference-equality containers which encode
 * low-level entity information.
 * @note the values of this enum are unstable, do not depend upon their values between versions of iTwin.js
 *       (e.g. do not serialize them and load them in another version of iTwin.js and expect them to work)
 * // FIXME implement this test
 * // FIXME: Aspect needs to be split into Multi and Unique, and relationship into Drives, Refers, ModelSelectorRefersTo
 * CodeSpecs are excepted since those are not treated like other entities.
 * @note the string value of each variant is required/guaranteed to be 1 character, this is confirmed in tests
 * @see ConcreteEntityId
 * @alpha
 */
export enum ConcreteEntityTypes {
  Model = "m",
  Element = "e",
  ElementAspect = "a",
  Relationship = "r",
}

/**
 * Adds some utilities to the [[ConcreteEntityTypes]] enum
 * @alpha
 */
export namespace ConcreteEntityTypes {
  const toBisCoreRootClassFullNameMap = {
    [ConcreteEntityTypes.Model]: "BisCore:Model",
    [ConcreteEntityTypes.Element]: "BisCore:Element",
    [ConcreteEntityTypes.ElementAspect]: "BisCore:ElementAspect",
    [ConcreteEntityTypes.Relationship]: "BisCore:Relationship",
  } as const;

  /** used by the transformer to figure out where to check for the existence in a db of a concrete element id
   * @internal
   */
  export function toBisCoreRootClassFullName(type: ConcreteEntityTypes): string {
    return toBisCoreRootClassFullNameMap[type];
  }
}

// FIXME: probably rename this to entity reference because otherwise every `entityId` local name is now ambiguous
/**
 * This id format can be used for storing a unique key for an entity in containers like `Map`.
 * Elements and non-element entities have different id sequences, they can collide with each other, but not within themselves.
 * @public
 */
export type ConcreteEntityId = `${ConcreteEntityTypes}${Id64String}`;

/** Utility functions for ConcreteEntityId which is a subset of string
 * @public
 */
export class ConcreteEntityIds {
  // for additional utilities that require runtime backend classes, see ConcreteEntityIds in `@itwin/core-backend`
  public static isModel(id: ConcreteEntityId) {
    return id[0] === ConcreteEntityTypes.Model;
  }
  public static isElement(id: ConcreteEntityId) {
    return id[0] === ConcreteEntityTypes.Element;
  }
  public static isElementAspect(id: ConcreteEntityId) {
    return id[0] === ConcreteEntityTypes.ElementAspect;
  }
  public static isRelationship(id: ConcreteEntityId) {
    return id[0] === ConcreteEntityTypes.Relationship;
  }
  public static toId64(id: ConcreteEntityId) {
    return id.slice(1);
  }

  /** split a concrete entity id into its type and raw id */
  public static split(id: ConcreteEntityId): [ConcreteEntityTypes, Id64String] {
    return [id[0] as ConcreteEntityTypes, id.slice(1)];
  }

  /** used by the transformer to figure out where to check for the existence in a db of a concrete element id
   * @internal
   */
  public static isValid(id: ConcreteEntityId): boolean {
    return Id64.isValid(ConcreteEntityIds.toId64(id));
  }

  /** create the invalid id for a concrete entity type
   * @internal
   */
  public static makeInvalid(type: ConcreteEntityTypes): ConcreteEntityId {
    return `${type}${Id64.invalid}`;
  }
}

/** A set of concrete entity ids, with additional functions to more literately add ids where you have the raw id and know what type it is
 * @public
 */
export class ConcreteEntityIdSet extends Set<ConcreteEntityId> {
  public addElement(id: Id64String) { this.add(`e${id}`); }
  public addModel(id: Id64String) { this.add(`m${id}`); }
  public addAspect(id: Id64String) { this.add(`a${id}`); }
  public addRelationship(id: Id64String) { this.add(`r${id}`); }
}
