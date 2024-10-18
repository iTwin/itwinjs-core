/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { from, mergeAll, mergeMap, Observable, reduce } from "rxjs";
import { ECSqlStatement, IModelDb } from "@itwin/core-backend";
import { DbResult, Id64String } from "@itwin/core-bentley";
import { PresentationError, PresentationStatus } from "@itwin/presentation-common";

/** @internal */
export function getElementsCount(db: IModelDb, classNames?: string[]) {
  const filter = createElementsFilter("e", classNames);
  const query = `
    SELECT COUNT(e.ECInstanceId)
    FROM bis.Element e
    ${filter ? `WHERE ${filter}` : ""}
  `;

  return db.withPreparedStatement(query, (stmt: ECSqlStatement) => {
    return stmt.step() === DbResult.BE_SQLITE_ROW ? stmt.getValue(0).getInteger() : 0;
  });
}

/** @internal */
export function parseFullClassName(fullClassName: string): [string, string] {
  const [schemaName, className] = fullClassName.split(/[:\.]/);
  return [schemaName, className];
}

function getECSqlName(fullClassName: string) {
  const [schemaName, className] = parseFullClassName(fullClassName);
  return `[${schemaName}].[${className}]`;
}

/** @internal */
export function getClassesWithInstances(imodel: IModelDb, fullClassNames: string[]): Observable<string> {
  return from(fullClassNames).pipe(
    mergeMap((fullClassName) => {
      const reader = imodel.createQueryReader(`
        SELECT s.Name, c.Name
        FROM ${getECSqlName(fullClassName)} e
        JOIN meta.ECClassDef c ON c.ECInstanceId = e.ECClassId
        JOIN meta.ECSchemaDef s on s.ECInstanceId = c.Schema.Id
        GROUP BY c.ECInstanceId
      `);
      return from(reader.toArray() as Promise<[string, string][]>);
    }),
    mergeAll(),
    reduce<[string, string], Set<string>>((set, [schemaName, className]) => {
      set.add(`${schemaName}.${className}`);
      return set;
    }, new Set()),
    mergeMap((set) => [...set]),
  );
}

/** @internal */
export async function getBatchedClassElementIds(
  imodel: IModelDb,
  fullClassName: string,
  batchSize: number,
): Promise<Array<{ from: Id64String; to: Id64String }>> {
  const batches = [];
  const reader = imodel.createQueryReader(`SELECT ECInstanceId id FROM ${getECSqlName(fullClassName)} ORDER BY ECInstanceId`);
  let currId: Id64String | undefined;
  let fromId: Id64String | undefined;
  let count = 0;
  while (await reader.step()) {
    currId = reader.current.toRow().id as Id64String;
    if (!fromId) {
      fromId = currId;
    }
    if (++count >= batchSize) {
      batches.push({ from: fromId, to: currId });
      fromId = undefined;
      count = 0;
    }
  }
  if (fromId && currId) {
    batches.push({ from: fromId, to: currId });
  }
  return batches;
}

function createElementsFilter(elementAlias: string, classNames?: string[]) {
  if (classNames === undefined || classNames.length === 0) {
    return undefined;
  }

  // check if list contains only valid class names
  const classNameRegExp = new RegExp(/^[\w]+[.:][\w]+$/);
  const invalidName = classNames.find((name) => !name.match(classNameRegExp));
  if (invalidName) {
    throw new PresentationError(
      PresentationStatus.InvalidArgument,
      `Encountered invalid class name - ${invalidName}.
      Valid class name formats: "<schema name or alias>.<class name>", "<schema name or alias>:<class name>"`,
    );
  }

  return `${elementAlias}.ECClassId IS (${classNames.join(",")})`;
}
