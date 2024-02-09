/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { ConcreteEntityTypes, ElementAspectProps, ElementProps, EntityReference, ModelProps } from "@itwin/core-common";
import { Id64, Id64String } from "@itwin/core-bentley";
import type { Entity } from "./Entity";
import { Model } from "./Model";
import { Element } from "./Element";
import { ElementAspect } from "./ElementAspect";
import { Relationship, RelationshipProps } from "./Relationship";
import * as assert from "assert";

/** Concrete classes that can be created, with the notable exception of CodeSpecs since it is does not derive from Entity
 * other entity classes. In the future if there is a need
 * to manage them this way, it can be added
 * @alpha
 */
export type ConcreteEntity = Element | Model | ElementAspect | Relationship;

/** Props for a [[ConcreteEntity]]
 * @alpha
 */
export type ConcreteEntityProps = ElementProps | ModelProps | ElementAspectProps | RelationshipProps;

/**
 * Utilities for the [EntityReference]($common) type which is a kind of strings
 * @alpha
 */
export namespace EntityReferences {
  export function isModel(id: EntityReference) {
    return id[0] === ConcreteEntityTypes.Model.valueOf();
  }
  export function isElement(id: EntityReference) {
    return id[0] === ConcreteEntityTypes.Element.valueOf();
  }
  export function isElementAspect(id: EntityReference) {
    return id[0] === ConcreteEntityTypes.ElementAspect.valueOf();
  }
  export function isRelationship(id: EntityReference) {
    return id[0] === ConcreteEntityTypes.Relationship.valueOf();
  }
  export function toId64(id: EntityReference) {
    return id.slice(1);
  }

  /** split a concrete entity id into its type and raw id */
  export function split(id: EntityReference): [ConcreteEntityTypes, Id64String] {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return [id[0] as ConcreteEntityTypes, id.slice(1)];
  }

  /** used by the transformer to figure out where to check for the existence in a db of a concrete element id
   * @internal
   */
  export function isValid(id: EntityReference): boolean {
    return Id64.isValid(toId64(id));
  }

  /** create the invalid id for a concrete entity type
   * @internal
   */
  export function makeInvalid(type: ConcreteEntityTypes): EntityReference {
    return `${type}${Id64.invalid}`;
  }

  /** create an EntityReference given an entity */
  export function from(entity: ConcreteEntity): EntityReference {
    const type = typeFromClass(entity.constructor as typeof Entity);
    return `${type}${entity.id}`;
  }

  /** create an EntityReference given an id and a JavaScript class */
  export function fromClass(id: Id64String, entityClass: typeof Entity): EntityReference {
    const type = typeFromClass(entityClass);
    return `${type}${id}`;
  }

  /** Create an EntityReference quickly from an exact reference type and id */
  export function fromEntityType(id: Id64String, type: ConcreteEntityTypes): EntityReference {
    return `${type}${id}`;
  }

  /** @internal the argument entityClass be concrete (i.e. not the Entity abstract base class) */
  export function typeFromClass(entityClass: typeof Entity): ConcreteEntityTypes {
    if (entityClass.is(Element))
      return ConcreteEntityTypes.Element;
    else if (entityClass.is(ElementAspect))
      return ConcreteEntityTypes.ElementAspect;
    else if (entityClass.is(Model))
      return ConcreteEntityTypes.Model;
    else if (entityClass.is(Relationship))
      return ConcreteEntityTypes.Relationship;
    else
      assert(false, "unknown or abstract entity type passed to EntityReferences.from");
  }
}
