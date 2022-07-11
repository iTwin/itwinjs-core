/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { ConcreteEntityIds as BentleyConcreteEntityIds, ConcreteEntityId, Id64String } from "@itwin/core-bentley";
import type { Entity } from "./Entity";
import { Element } from "./Element";
import { ElementAspect } from "./ElementAspect";
import { Relationship, RelationshipProps } from "./Relationship";
import { Model } from "./Model";
import { ElementAspectProps, ElementProps, ModelProps } from "@itwin/core-common";

// re-export so consumers don't need to manually import the basic types we are extending
export * from "@itwin/core-bentley/lib/cjs/ConcreteEntityId";

// FIXME: Aspect needs to be split into Multi and Unique, and relationship into Drives, Refers, ModelSelectorRefersTo
/** an entity that can be created  */
export type ConcreteEntity = Element | Model | ElementAspect | Relationship;

export type ConcreteEntityProps = ElementProps | ModelProps | ElementAspectProps | RelationshipProps;

/**
 * Utility function namespace for the ConcreteEntityId type which is a string
 * @public
 */
export class ConcreteEntityIds extends BentleyConcreteEntityIds {
  public static from(entity: ConcreteEntity): ConcreteEntityId {
    return `${entity instanceof Element ? "e" : entity instanceof ElementAspect ? "a" : "r"}:${entity.id}`;
  }
  public static fromClass(entityClass: typeof Entity, id: Id64String): ConcreteEntityId {
    return `${entityClass.is(Element) ? "e": entityClass.is(ElementAspect)  ? "a" : "r"}:${id}`;
  }
}
