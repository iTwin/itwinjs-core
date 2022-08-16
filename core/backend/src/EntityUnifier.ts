/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 * utilities that unify operations, especially CRUD operations, on entities
 * for entity-generic operations in the transformer
 */
import * as assert from "assert";
import { ConcreteEntityId, ConcreteEntityIds, ConcreteEntityTypes, Id64String } from "@itwin/core-bentley";
import { DbResult, IModelError } from "@itwin/core-common";
import { ConcreteEntity, ConcreteEntityProps } from "./ConcreteEntityId";
import { ElementAspect } from "./ElementAspect";
import { Element } from "./Element";
import { Relationship } from "./Relationship";
import { IModelDb } from "./IModelDb";

/** @internal */
export namespace EntityUnifier {
  export function getReadableType(entity: ConcreteEntity) {
    if (entity instanceof Element) return "element";
    else if (entity instanceof ElementAspect) return "element aspect";
    else if (entity instanceof Relationship) return "relationship";
    else return "unknown entity type";
  }

  type EntityUpdater = (entityProps: ConcreteEntityProps) => void;

  /** needs to return a widened type otherwise typescript complains when result is used with a narrow type */
  export function updaterFor(db: IModelDb, entity: ConcreteEntity) {
    if (entity instanceof Element) return db.elements.updateElement.bind(db.elements) as EntityUpdater;
    else if (entity instanceof Relationship) return db.relationships.updateInstance.bind(db.relationships) as EntityUpdater;
    else if (entity instanceof ElementAspect) return db.elements.updateAspect.bind(db.elements) as EntityUpdater;
    else assert(false, `unreachable; entity was '${entity.constructor.name}' not an Element, Relationship, or ElementAspect`);
  }

  export function exists(db: IModelDb, arg: { entity: ConcreteEntity } | { id: Id64String } | { concreteEntityId: ConcreteEntityId }) {
    if ("concreteEntityId" in arg) {
      const [type, id] = ConcreteEntityIds.split(arg.concreteEntityId);
      const bisCoreRootClassName = ConcreteEntityTypes.toBisCoreRootClassFullName(type);
      return db.withPreparedStatement(`SELECT 1 FROM ${bisCoreRootClassName} WHERE ECInstanceId=?`, (stmt) => {
        stmt.bindId(1, id);
        const matchesResult = stmt.step();
        if (matchesResult === DbResult.BE_SQLITE_ROW) return true;
        if (matchesResult === DbResult.BE_SQLITE_DONE) return false;
        else throw new IModelError(matchesResult, "query failed");
      });
    } else if ("entity" in arg) {
      return db.withPreparedStatement(`SELECT 1 FROM [${arg.entity.schemaName}].[${arg.entity.className}] WHERE ECInstanceId=?`, (stmt) => {
        stmt.bindId(1, arg.entity.id);
        const matchesResult = stmt.step();
        if (matchesResult === DbResult.BE_SQLITE_ROW) return true;
        if (matchesResult === DbResult.BE_SQLITE_DONE) return false;
        else throw new IModelError(matchesResult, "query failed");
      });
    } else {
      // FIXME: maybe lone id should default to an element id for backwards compat?
      // or just not be supported, I don't think this is even called atm
      return db.withPreparedStatement(`
        SELECT 1 FROM (
          -- all possible bis core root types
          -- FIXME: create a test verifying the assumption that this is all of them...
          -- Should probably construct this query at module import time from the same list that the test uses
          -- for a single source of truth
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
