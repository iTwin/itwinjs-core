/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 * utilities that unify operations, especially CRUD operations, on entities
 * for entity-generic operations in the transformer
 */
import { Element, ElementAspect, Entity, IModelDb, Relationship } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { DbResult, ElementAspectProps, ElementProps, IModelError, RelationshipProps } from "@itwin/core-common";
import { IModelTransformer } from "./IModelTransformer";

/** Elements and non-element entities have different id sequences, they can overlap each other, but not within themselves
 * @internal
 */
export type ConcreteEntityId = `Element${Id64String}` | `NonElement${Id64String}`;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace ConcreteEntityId {
  export function makeElement(id: Id64String): ConcreteEntityId { return `Element${id}`; }
  export function makeNonElement(id: Id64String): ConcreteEntityId { return `NonElement${id}`; }
  export function from(entity: Entity): ConcreteEntityId {
    return `${entity instanceof Element ? "Element" : "NonElement"}:${entity.id}`;
  }
}

/** @internal an entity with CRUD routines */
type ConcreteEntity = Element | ElementAspect | Relationship;

/** @internal props for an entity with CRUD routines */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ConcreteEntityProps = ElementProps | ElementAspectProps | RelationshipProps;

/** @internal */
function unreachable(entity: any): never {
  throw Error(`unreachable; entity was '${entity.constructor.name}' not an Element, Relationship, or ElementAspect`);
}

/** @internal */
export namespace EntityUnifier {
  export function getReadableType(entity: ConcreteEntity) {
    if (entity instanceof Element) return "element";
    else if (entity instanceof ElementAspect) return "element aspect";
    else if (entity instanceof Relationship) return "relationship";
    else return "unknown entity type";
  }

  type EntityTransformHandler = (entity: Element | Relationship | ElementAspect) => ElementProps | RelationshipProps | ElementAspectProps;

  export function transformCallbackFor(transformer: IModelTransformer, entity: ConcreteEntity) {
    if (entity instanceof Element) return transformer.onTransformElement as EntityTransformHandler; // eslint-disable-line @typescript-eslint/unbound-method
    // grab these methods even though they're protected since we don't want to make them public but think this function is better here than on the transformer
    else if (entity instanceof Relationship) return transformer["onTransformRelationship"] as EntityTransformHandler; // eslint-disable-line @typescript-eslint/dot-notation
    else if (entity instanceof ElementAspect) return transformer["onTransformElementAspect"] as EntityTransformHandler; // eslint-disable-line @typescript-eslint/dot-notation
    else unreachable(entity);
  }

  type EntityUpdater = (entityProps: ElementProps | RelationshipProps | ElementAspectProps) => void;

  /** needs to return a widened type otherwise typescript complains when result is used with a narrow type */
  export function updaterFor(db: IModelDb, entity: ConcreteEntity) {
    if (entity instanceof Element) return db.elements.updateElement.bind(db.elements) as EntityUpdater;
    else if (entity instanceof Relationship) return db.relationships.updateInstance.bind(db.relationships) as EntityUpdater;
    else if (entity instanceof ElementAspect) return db.elements.updateAspect.bind(db.elements) as EntityUpdater;
    else unreachable(entity);
  }

  export function exists(db: IModelDb, arg: { entity: ConcreteEntity } | { id: Id64String }) {
    if ("entity" in arg) {
      return db.withPreparedStatement(`SELECT 1 FROM [${arg.entity.schemaName}].[${arg.entity.className}] WHERE ECInstanceId=?`, (stmt) => {
        stmt.bindId(1, arg.entity.id);
        const matchesResult = stmt.step();
        if (matchesResult === DbResult.BE_SQLITE_ROW) return true;
        if (matchesResult === DbResult.BE_SQLITE_DONE) return false;
        else throw new IModelError(matchesResult, "query failed");
      });
    } else {
      return db.withPreparedStatement(`
        SELECT 1 FROM (
          -- all possible bis core root types
          -- TODO: create a test verifying the assumption that this is all of them...
          SELECT ECInstanceId FROM bis.Element
          UNION ALL
          SELECT ECInstanceId FROM bis.ElementMultiAspect
          UNION ALL
          SELECT ECInstanceId FROM bis.ElementUniqueAspect
          UNION ALL
          SELECT ECInstanceId FROM bis.ElementRefersToElements
          UNION ALL
          SELECT ECInstanceId FROM bis.ElementDrivesElement
          UNION ALL
          SELECT ECInstanceId FROM bis.ModelSelectorRefersToModels
        ) WHERE ECInstanceId=?
      `, (stmt) => {
        stmt.bindId(1, arg.id);
        const matchesResult = stmt.step();
        if (matchesResult === DbResult.BE_SQLITE_ROW) return true;
        if (matchesResult === DbResult.BE_SQLITE_DONE) return false;
        else throw new IModelError(matchesResult, "query failed");
      });
    }
  }
}
