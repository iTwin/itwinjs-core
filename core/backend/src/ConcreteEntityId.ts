/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { ConcreteEntityIds as BentleyConcreteEntityIds, ConcreteEntityId, ConcreteEntityTypes, Id64String } from "@itwin/core-bentley";
import { ElementAspectProps, ElementProps, ModelProps } from "@itwin/core-common";
import type { Entity } from "./Entity";
import type { Model } from "./Model";
import type { Element } from "./Element";
import type { ElementAspect } from "./ElementAspect";
import type { Relationship, RelationshipProps } from "./Relationship";
import * as assert from "assert";

// re-export so consumers don't need to manually import the basic types we are extending
export * from "@itwin/core-bentley/lib/cjs/ConcreteEntityId";

// FIXME: Aspect needs to be split into Multi and Unique, and relationship into Drives, Refers, ModelSelectorRefersTo
/** an entity that can be created, with the notable exception of CodeSpecs since those are not treated like other entities */
export type ConcreteEntity = Element | Model | ElementAspect | Relationship;

export type ConcreteEntityProps = ElementProps | ModelProps | ElementAspectProps | RelationshipProps;

/**
 * Utility function namespace for the ConcreteEntityId type which is a string
 * @public
 */
export class ConcreteEntityIds extends BentleyConcreteEntityIds {

  // TODO: fix this horror somehow
  // necessary to prevent cyclic dependencies, the required modules will be in the require cache already so I don't store
  /* eslint-disable @typescript-eslint/naming-convention,@typescript-eslint/no-var-requires */
  private static get _ElementClass() {
    // typescript doesn't seem to understand the types of these static relative imports
    return (require("./Element") as typeof import("./Element")).Element;
  }
  private static get _ElementAspectClass() {
    return (require("./ElementAspect") as typeof import("./ElementAspect")).ElementAspect;
  }
  private static get _ModelClass() {
    return (require("./Model") as typeof import("./Model")).Model;
  }
  private static get _RelationshipClass() {
    return (require("./Relationship") as typeof import("./Relationship")).Relationship;
  }
  private static get _ClassRegistry() {
    return (require("./ClassRegistry") as typeof import("./ClassRegistry")).ClassRegistry;
  }
  /* eslint-enable @typescript-eslint/naming-convention,@typescript-eslint/no-var-requires */

  public static from(entity: ConcreteEntity): ConcreteEntityId {
    const type = this.typeFromClass(entity.constructor as typeof Entity);
    return `${type}${entity.id}`;
  }

  public static fromClass(id: Id64String, entityClass: typeof Entity): ConcreteEntityId {
    const type = this.typeFromClass(entityClass);
    return `${type}${id}`;
  }

  /** Searches for a class by name in the [ClassRegistry]($backend) */
  public static fromClassFullName(id: Id64String, classFullName: string): ConcreteEntityId {
    const ecclass = this._ClassRegistry.findRegisteredClass(classFullName);
    if (ecclass === undefined) throw Error(`class '${classFullName}' is not registered and could not be found`);
    return this.fromClass(id, ecclass);
  }

  /** Searches for a class by name in the [ClassRegistry]($backend) */
  public static fromEntityType(id: Id64String, type: ConcreteEntityTypes): ConcreteEntityId {
    return `${type}${id}`;
  }

  /** @internal the argument entityClass be concrete (i.e. not the Entity abstract base class) */
  public static typeFromClass(entityClass: typeof Entity): ConcreteEntityTypes {
    if (entityClass.is(this._ElementClass)) return ConcreteEntityTypes.Element;
    else if (entityClass.is(this._ElementAspectClass)) return ConcreteEntityTypes.ElementAspect;
    else if (entityClass.is(this._ModelClass)) return ConcreteEntityTypes.Model;
    else if (entityClass.is(this._RelationshipClass)) return ConcreteEntityTypes.Relationship;
    else assert(false, "unknown or abstract entity type passed to ConcreteEntityIds.from");
  }
}
