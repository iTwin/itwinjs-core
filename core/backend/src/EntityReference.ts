/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { ConcreteEntityTypes, ElementAspectProps, ElementProps, ModelProps } from "@itwin/core-common";
import type { EntityReference } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley";
import type { Entity } from "./Entity";
import type { Model } from "./Model";
import type { Element } from "./Element";
import type { ElementAspect } from "./ElementAspect";
import type { Relationship, RelationshipProps } from "./Relationship";
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
 * Utility function namespace for the EntityReference type which is a string
 * @alpha
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace EntityReference {

  // necessary to prevent cyclic dependencies, the required modules will be in the require cache already so I don't store
  /* eslint-disable @typescript-eslint/naming-convention,@typescript-eslint/no-var-requires */
  function _ElementClass() {
    // typescript doesn't seem to understand the types of these static relative imports
    return (require("./Element") as typeof import("./Element")).Element;
  }
  function _ElementAspectClass() {
    return (require("./ElementAspect") as typeof import("./ElementAspect")).ElementAspect;
  }
  function _ModelClass() {
    return (require("./Model") as typeof import("./Model")).Model;
  }
  function _RelationshipClass() {
    return (require("./Relationship") as typeof import("./Relationship")).Relationship;
  }
  function _ClassRegistry() {
    return (require("./ClassRegistry") as typeof import("./ClassRegistry")).ClassRegistry;
  }
  /* eslint-enable @typescript-eslint/naming-convention,@typescript-eslint/no-var-requires */

  /** create an EntityReference given an entity */
  export function from(entity: ConcreteEntity): EntityReference {
    const type = EntityReference.typeFromClass(entity.constructor as typeof Entity);
    return `${type}${entity.id}`;
  }

  /** create an EntityReference given an id and a JavaScript class */
  export function fromClass(id: Id64String, entityClass: typeof Entity): EntityReference {
    const type = EntityReference.typeFromClass(entityClass);
    return `${type}${id}`;
  }

  /** Create an EntityReference given an id and a qualified EC class name
   * @note Searches for a class by name in the [ClassRegistry]($backend)
   */
  export function fromClassFullName(id: Id64String, classFullName: string): EntityReference {
    const ecclass = _ClassRegistry().findRegisteredClass(classFullName);
    if (ecclass === undefined) throw Error(`class '${classFullName}' is not registered and could not be found`);
    return EntityReference.fromClass(id, ecclass);
  }

  /** Create an EntityReference quickly from an exact reference type and id */
  export function fromEntityType(id: Id64String, type: ConcreteEntityTypes): EntityReference {
    return `${type}${id}`;
  }

  /** @internal the argument entityClass be concrete (i.e. not the Entity abstract base class) */
  export function typeFromClass(entityClass: typeof Entity): ConcreteEntityTypes {
    if (entityClass.is(_ElementClass())) return ConcreteEntityTypes.Element;
    else if (entityClass.is(_ElementAspectClass())) return ConcreteEntityTypes.ElementAspect;
    else if (entityClass.is(_ModelClass())) return ConcreteEntityTypes.Model;
    else if (entityClass.is(_RelationshipClass())) return ConcreteEntityTypes.Relationship;
    else assert(false, "unknown or abstract entity type passed to EntityReference.from");
  }
}
