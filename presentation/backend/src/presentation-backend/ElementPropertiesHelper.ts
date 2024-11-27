/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { bufferCount, defer, from, groupBy, map, mergeMap, Observable, ObservedValueOf, of, range, reduce } from "rxjs";
import { ECSqlStatement, IModelDb } from "@itwin/core-backend";
import { DbResult, Id64, Id64Array, Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import { QueryRowProxy } from "@itwin/core-common";
import {
  ContentDescriptorRequestOptions,
  ContentRequestOptions,
  Descriptor,
  Item,
  KeySet,
  PresentationError,
  PresentationStatus,
  Ruleset,
  RulesetVariable,
} from "@itwin/presentation-common";

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
export function getContentItemsObservableFromElementIds(
  imodel: IModelDb,
  contentDescriptorGetter: (
    partialProps: Pick<ContentDescriptorRequestOptions<IModelDb, KeySet, RulesetVariable>, "rulesetOrId" | "keys">,
  ) => Promise<Descriptor | undefined>,
  contentSetGetter: (
    partialProps: Pick<ContentRequestOptions<IModelDb, Descriptor, KeySet, RulesetVariable>, "rulesetOrId" | "keys" | "descriptor">,
  ) => Promise<Item[]>,
  elementIds: Id64String[],
  classParallelism: number,
  batchesParallelism: number,
  batchSize: number,
): { itemBatches: Observable<{ descriptor: Descriptor; items: Item[] }>; count: Observable<number> } {
  return {
    itemBatches: getElementClassesFromIds(imodel, elementIds).pipe(
      mergeMap(
        ({ classFullName, ids }) =>
          getBatchedClassContentItems(
            classFullName,
            contentDescriptorGetter,
            contentSetGetter,
            () => createIdBatches(OrderedId64Iterable.sortArray(ids), batchSize),
            batchesParallelism,
          ),
        classParallelism,
      ),
    ),
    count: of(elementIds.length),
  };
}

/** @internal */
export function getContentItemsObservableFromClassNames(
  imodel: IModelDb,
  contentDescriptorGetter: (
    partialProps: Pick<ContentDescriptorRequestOptions<IModelDb, KeySet, RulesetVariable>, "rulesetOrId" | "keys">,
  ) => Promise<Descriptor | undefined>,
  contentSetGetter: (
    partialProps: Pick<ContentRequestOptions<IModelDb, Descriptor, KeySet, RulesetVariable>, "rulesetOrId" | "keys" | "descriptor">,
  ) => Promise<Item[]>,
  elementClasses: string[],
  classParallelism: number,
  batchesParallelism: number,
  batchSize: number,
): { itemBatches: Observable<{ descriptor: Descriptor; items: Item[] }>; count: Observable<number> } {
  return {
    itemBatches: getClassesWithInstances(imodel, elementClasses).pipe(
      mergeMap(
        (classFullName) =>
          getBatchedClassContentItems(
            classFullName,
            contentDescriptorGetter,
            contentSetGetter,
            () => getBatchedClassElementIds(imodel, classFullName, batchSize),
            batchesParallelism,
          ),
        classParallelism,
      ),
    ),
    count: of(getElementsCount(imodel, elementClasses)),
  };
}

function getBatchedClassContentItems(
  classFullName: string,
  contentDescriptorGetter: (
    partialProps: Pick<ContentDescriptorRequestOptions<IModelDb, KeySet, RulesetVariable>, "rulesetOrId" | "keys">,
  ) => Promise<Descriptor | undefined>,
  contentSetGetter: (
    partialProps: Pick<ContentRequestOptions<IModelDb, Descriptor, KeySet, RulesetVariable>, "rulesetOrId" | "keys" | "descriptor">,
  ) => Promise<Item[]>,
  batcher: () => Observable<Array<{ from: Id64String; to: Id64String }>>,
  batchesParallelism: number,
): Observable<{ descriptor: Descriptor; items: Item[] }> {
  return of({
    ruleset: createClassContentRuleset(classFullName),
    keys: new KeySet(),
  }).pipe(
    mergeMap(({ ruleset, keys }) =>
      defer(async () => {
        const descriptor = await contentDescriptorGetter({ rulesetOrId: ruleset, keys });
        if (!descriptor) {
          throw new PresentationError(PresentationStatus.Error, `Failed to get descriptor for class ${classFullName}`);
        }
        return descriptor;
      }).pipe(
        // create elements' id batches
        mergeMap((descriptor) => batcher().pipe(map((batch) => ({ descriptor, batch })))),
        // request content for each batch, filter by IDs for performance
        mergeMap(
          ({ descriptor, batch }) =>
            defer(async () => {
              const filteringDescriptor = new Descriptor(descriptor);
              filteringDescriptor.instanceFilter = {
                selectClassName: classFullName,
                expression: createElementIdsECExpressionFilter(batch),
              };
              return contentSetGetter({
                rulesetOrId: ruleset,
                keys,
                descriptor: filteringDescriptor,
              });
            }).pipe(map((items) => ({ descriptor, items }))),
          batchesParallelism,
        ),
      ),
    ),
  );
}

function createElementIdsECExpressionFilter(batch: Array<{ from: Id64String; to: Id64String }>): string {
  let filter = "";
  function appendCondition(cond: string) {
    if (filter.length > 0) {
      filter += " OR ";
    }
    filter += cond;
  }
  for (const item of batch) {
    if (item.from === item.to) {
      appendCondition(`this.ECInstanceId = ${item.from}`);
    } else {
      appendCondition(`this.ECInstanceId >= ${item.from} AND this.ECInstanceId <= ${item.to}`);
    }
  }
  return filter;
}

function createClassContentRuleset(fullClassName: string): Ruleset {
  const [schemaName, className] = parseFullClassName(fullClassName);
  return {
    id: `content/class-descriptor/${fullClassName}`,
    rules: [
      {
        ruleType: "Content",
        specifications: [
          {
            specType: "ContentInstancesOfSpecificClasses",
            classes: {
              schemaName,
              classNames: [className],
              arePolymorphic: false,
            },
            handlePropertiesPolymorphically: true,
          },
        ],
      },
    ],
  };
}

/** Given a list of element ids, group them by class name. */
function getElementClassesFromIds(imodel: IModelDb, elementIds: string[]): Observable<{ classFullName: string; ids: Id64Array }> {
  const elementIdsBatchSize = 5000;
  return range(0, elementIds.length / elementIdsBatchSize).pipe(
    mergeMap((batchIndex) => {
      const idsFrom = batchIndex * elementIdsBatchSize;
      const idsTo = Math.min(idsFrom + elementIdsBatchSize, elementIds.length);
      let idsFilter = "";
      for (let i = idsFrom; i < idsTo; i++) {
        idsFilter += `${elementIds[i]}`;
        if (i < idsTo - 1) {
          idsFilter += ",";
        }
      }
      return from(
        imodel.createQueryReader(
          `
            SELECT ec_classname(e.ECClassId) className, GROUP_CONCAT(IdToHex(e.ECInstanceId)) ids
            FROM bis.Element e
            WHERE e.ECInstanceId IN (${idsFilter})
            GROUP BY e.ECClassId
          `,
        ),
      );
    }),
    map((row: QueryRowProxy): { className: string; ids: Id64Array } => ({ className: row.className, ids: row.ids.split(",") })),
    groupBy(({ className }) => className),
    mergeMap((groups) =>
      groups.pipe(
        reduce<ObservedValueOf<typeof groups>, { classFullName: string; ids: Id64Array }>(
          (acc, g) => {
            g.ids.forEach((id) => acc.ids.push(id));
            return {
              classFullName: g.className,
              ids: acc.ids,
            };
          },
          { classFullName: "", ids: [] },
        ),
      ),
    ),
  );
}

/** Given a list of full class names, get a stream of actual class names that have instances. */
function getClassesWithInstances(imodel: IModelDb, fullClassNames: string[]): Observable<string> {
  return from(fullClassNames).pipe(
    mergeMap((fullClassName) =>
      from(
        imodel.createQueryReader(
          `
            SELECT ec_classname(e.ECClassId, 's.c') className
            FROM ${getECSqlName(fullClassName)} e
            GROUP BY e.ECClassId
          `,
        ),
      ),
    ),
    map((row: QueryRowProxy): string => row.className),
  );
}

/**
 * Given a sorted list of ECInstanceIds and a batch size, create a stream of batches. Because the IDs won't necessarily
 * be sequential, a batch is defined a list of from-to pairs.
 * @internal
 */
export function createIdBatches(sortedIds: Id64String[], batchSize: number): Observable<Array<{ from: Id64String; to: Id64String }>> {
  return range(0, sortedIds.length / batchSize).pipe(
    map((batchIndex) => {
      const sequences = new Array<{ from: Id64String; to: Id64String }>();
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min((batchIndex + 1) * batchSize, sortedIds.length) - 1;
      let fromId = sortedIds[startIndex];
      let to = {
        id: sortedIds[startIndex],
        localId: Id64.getLocalId(sortedIds[startIndex]),
      };
      for (let i = startIndex + 1; i <= endIndex; ++i) {
        const currLocalId = Id64.getLocalId(sortedIds[i]);
        if (currLocalId !== to.localId + 1) {
          sequences.push({ from: fromId, to: sortedIds[i - 1] });
          fromId = sortedIds[i];
        }
        to = { id: sortedIds[i], localId: currLocalId };
      }
      sequences.push({ from: fromId, to: sortedIds[endIndex] });
      return sequences;
    }),
  );
}

/**
 * Query all ECInstanceIds from given class and stream from-to pairs that batch the items into batches of `batchSize` size.
 * @internal
 */
export function getBatchedClassElementIds(imodel: IModelDb, fullClassName: string, batchSize: number): Observable<Array<{ from: Id64String; to: Id64String }>> {
  return from(imodel.createQueryReader(`SELECT IdToHex(ECInstanceId) id FROM ${getECSqlName(fullClassName)} ORDER BY ECInstanceId`)).pipe(
    map((row): Id64String => row.id),
    bufferCount(batchSize),
    map((batch) => [{ from: batch[0], to: batch[batch.length - 1] }]),
  );
}

/** @internal */
export function getElementsCount(db: IModelDb, classNames: string[]) {
  const whereClause = (() => {
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
    return `e.ECClassId IS (${classNames.join(",")})`;
  })();
  const query = `
    SELECT COUNT(e.ECInstanceId)
    FROM bis.Element e
    ${whereClause ? `WHERE ${whereClause}` : ""}
  `;
  return db.withPreparedStatement(query, (stmt: ECSqlStatement) => {
    return stmt.step() === DbResult.BE_SQLITE_ROW ? stmt.getValue(0).getInteger() : 0;
  });
}
