/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Id64String } from "@itwin/core-bentley";
import type { Entity } from "./Entity";
import { Element } from "./Element";
import { ElementAspect } from "./ElementAspect";
import { Relationship } from "./Relationship";

/** @internal an entity with CRUD routines */
type ConcreteEntity = Element | ElementAspect | Relationship;

/**
 * This id format can be used for storing a unique key for an entity in containers like `Map`.
 * Elements and non-element entities have different id sequences, they can collide with each other, but not within themselves.
 * @public
 */
export type ConcreteEntityId =
  /* an element instance */
  | `e${Id64String}`
  /* an aspect instance */
  | `a${Id64String}`
  /** a relationship entity, so a link table relationship instance */
  | `r${Id64String}`;

/**
 * Utility function namespace for the ConcreteEntityId type which is a string
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace ConcreteEntityId {
  export function from(entity: ConcreteEntity): ConcreteEntityId {
    return `${entity instanceof Element ? "e" : entity instanceof ElementAspect ? "a" : "r"}:${entity.id}`;
  }
  export function fromClass(entityClass: typeof Entity, id: Id64String): ConcreteEntityId {
    return `${entityClass.is(Element) ? "e": entityClass.is(ElementAspect)  ? "a" : "r"}:${id}`;
  }
}
