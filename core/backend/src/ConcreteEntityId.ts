/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { ConcreteEntityIds as BentleyConcreteEntityIds, ConcreteEntityId, Id64String } from "@itwin/core-bentley";
import { ElementAspectProps, ElementProps, ModelProps } from "@itwin/core-common";
import type { Entity } from "./Entity";
import type { Model } from "./Model";
import type { Element } from "./Element";
import type { ElementAspect } from "./ElementAspect";
import type { Relationship, RelationshipProps } from "./Relationship";

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
  // TODO: fix this horror somehow
  // necessary to prevent cyclic dependencies, the required modules will be in the require cache already
  /* eslint-disable @typescript-eslint/naming-convention */
  private static get _ElementClass() { return require("./Element").Element; } // eslint-disable-line @typescript-eslint/no-var-requires
  private static get _ElementAspectClass() { return require("./ElementAspect").ElementAspect; } // eslint-disable-line @typescript-eslint/no-var-requires
  /* eslint-enable @typescript-eslint/naming-convention */
  public static from(entity: ConcreteEntity): ConcreteEntityId {
    return `${entity instanceof this._ElementClass ? "e" : entity instanceof this._ElementAspectClass ? "a" : "r"}:${entity.id}`;
  }
  public static fromClass(entityClass: typeof Entity, id: Id64String): ConcreteEntityId {
    return `${entityClass.is(this._ElementClass) ? "e": entityClass.is(this._ElementAspectClass)  ? "a" : "r"}:${id}`;
  }
}
