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
 * CodeSpecs are excepted since their JavaScript representation does not derive from [Entity]($backend)
 * @note the string value of each variant is required/guaranteed to be 1 character
 * @see EntityReference
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

/**
 * This id format can be used for storing a unique key for an entity in containers like `Map`.
 * Elements and non-element entities have different id sequences, they can collide with each other, but not within themselves.
 * @note for additional utilities that require runtime backend classes, see [EntityReferences]($backend)
 * @alpha
 */
export type EntityReference = `${ConcreteEntityTypes}${Id64String}`;

/** Utility functions for [[EntityReference]] which is a subset of string
 * @alpha
 */
export class EntityReferences {
  public static isModel(id: EntityReference) {
    return id[0] === ConcreteEntityTypes.Model;
  }
  public static isElement(id: EntityReference) {
    return id[0] === ConcreteEntityTypes.Element;
  }
  public static isElementAspect(id: EntityReference) {
    return id[0] === ConcreteEntityTypes.ElementAspect;
  }
  public static isRelationship(id: EntityReference) {
    return id[0] === ConcreteEntityTypes.Relationship;
  }
  public static toId64(id: EntityReference) {
    return id.slice(1);
  }

  /** split a concrete entity id into its type and raw id */
  public static split(id: EntityReference): [ConcreteEntityTypes, Id64String] {
    return [id[0] as ConcreteEntityTypes, id.slice(1)];
  }

  /** used by the transformer to figure out where to check for the existence in a db of a concrete element id
   * @internal
   */
  public static isValid(id: EntityReference): boolean {
    return Id64.isValid(EntityReferences.toId64(id));
  }

  /** create the invalid id for a concrete entity type
   * @internal
   */
  public static makeInvalid(type: ConcreteEntityTypes): EntityReference {
    return `${type}${Id64.invalid}`;
  }
}

/** A set of concrete entity ids, with additional functions to more literately add ids where you have the raw id and know what type it is
 * @alpha
 */
export class EntityReferenceSet extends Set<EntityReference> {
  public addElement(id: Id64String) { this.add(`e${id}`); }
  public addModel(id: Id64String) { this.add(`m${id}`); }
  public addAspect(id: Id64String) { this.add(`a${id}`); }
  public addRelationship(id: Id64String) { this.add(`r${id}`); }
}
