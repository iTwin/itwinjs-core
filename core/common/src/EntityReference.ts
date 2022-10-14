/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Id64String } from "@itwin/core-bentley";

/**
 * Types of concrete entities. Used for storing strings in JavaScript reference-equality containers which encode
 * low-level entity information.
 * @note the values of this enum are unstable, do not depend upon their values between versions of iTwin.js
 *       (e.g. do not serialize them and load them in another version of iTwin.js and expect them to work)
 * CodeSpecs are excepted since their JavaScript representation does not derive from [Entity]($backend)
 * @note the string value of each variant is required/guaranteed to be 1 character
 * @see EntityReference
 * @internal
 */
export enum ConcreteEntityTypes {
  Model = "m",
  Element = "e",
  ElementAspect = "a",
  Relationship = "r",
}

/**
 * Adds some utilities to the [[ConcreteEntityTypes]] enum
 * @internal
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

/**
 * This id format can be used for storing a unique key for an entity in containers like `Map`.
 * Elements and non-element entities have different id sequences, they can collide with each other, but not within themselves.
 * @note for utilities that require runtime backend classes, see [EntityReferences]($backend)
 * @internal
 */
export type EntityReference = `${ConcreteEntityTypes}${Id64String}`;

/** A set of concrete entity ids, with additional functions to more literately add ids where you have the raw id and know what type it is
 * @internal
 */
export class EntityReferenceSet extends Set<EntityReference> {
  public addElement(id: Id64String) { this.add(`e${id}`); }
  public addModel(id: Id64String) { this.add(`m${id}`); }
  public addAspect(id: Id64String) { this.add(`a${id}`); }
  public addRelationship(id: Id64String) { this.add(`r${id}`); }
}

/** @internal entity reference type information of a relationship */
export interface RelTypeInfo {
  source: ConcreteEntityTypes;
  target: ConcreteEntityTypes;
}
