/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { bufferCount, defer, from, groupBy, map, mergeMap, Observable, ObservedValueOf, of, range, reduce } from "rxjs";
import { IModelDb } from "@itwin/core-backend";
import { Id64, Id64Array, Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import { QueryBinder, QueryRowProxy } from "@itwin/core-common";
import {
  ContentDescriptorRequestOptions,
  ContentRequestOptions,
  Descriptor,
  Field,
  Item,
  KeySet,
  NestedContentField,
  PresentationError,
  PresentationStatus,
  Ruleset,
  RulesetVariable,
} from "@itwin/presentation-common";
import { parseFullClassName } from "@itwin/presentation-shared";

function getECSqlName(fullClassName: string) {
  const { schemaName, className } = parseFullClassName(fullClassName);
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
            imodel,
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
            imodel,
            classFullName,
            contentDescriptorGetter,
            contentSetGetter,
            () => getBatchedClassElementIds(imodel, classFullName, batchSize),
            batchesParallelism,
          ),
        classParallelism,
      ),
    ),
    count: from(getElementsCount(imodel, elementClasses)),
  };
}

function getBatchedClassContentItems(
  imodel: IModelDb,
  classFullName: string,
  contentDescriptorGetter: (
    partialProps: Pick<ContentDescriptorRequestOptions<IModelDb, KeySet, RulesetVariable>, "rulesetOrId" | "keys">,
  ) => Promise<Descriptor | undefined>,
  contentSetGetter: (
    partialProps: Pick<ContentRequestOptions<IModelDb, Descriptor, KeySet, RulesetVariable>, "rulesetOrId" | "keys" | "descriptor">,
  ) => Promise<Item[]>,
  batcher: () => Observable<ElementIdBatch>,
  batchesParallelism: number,
): Observable<{ descriptor: Descriptor; items: Item[] }> {
  return defer(async () => {
    const ruleset = createClassContentRuleset(classFullName);
    const keys = new KeySet();
    const descriptor = await contentDescriptorGetter({ rulesetOrId: ruleset, keys });
    if (!descriptor) {
      throw new PresentationError(PresentationStatus.Error, `Failed to get descriptor for class ${classFullName}`);
    }
    const aspectFields = getPrunableAspectFields(descriptor, classFullName);
    return { descriptor, keys, ruleset, aspectFields };
  }).pipe(
    mergeMap((x) => batcher().pipe(map((batch) => ({ ...x, batch })))),
    mergeMap(
      ({ descriptor, keys, ruleset, batch, aspectFields }) =>
        defer(async () => {
          const batchDescriptor = new Descriptor(descriptor);
          batchDescriptor.instanceFilter = {
            selectClassName: classFullName,
            expression: batch.ranges
              .map(({ from: fromId, to }) =>
                fromId === to ? `this.ECInstanceId = ${fromId}` : `this.ECInstanceId >= ${fromId} AND this.ECInstanceId <= ${to}`,
              )
              .join(" OR "),
          };
          if (aspectFields.length) {
            await selectBatchAspectFields(imodel, batchDescriptor, aspectFields, batch.ids);
          }
          const items = await contentSetGetter({
            rulesetOrId: ruleset,
            keys,
            descriptor: batchDescriptor,
          });
          return { descriptor: batchDescriptor, items };
        }),
      batchesParallelism,
    ),
  );
}

function getPrunableAspectFields(descriptor: Descriptor, classFullName: string): NestedContentField[] {
  // Caller selections take precedence; don't replace an include/exclude selector with our own.
  if (descriptor.fieldsSelector || countFields(descriptor.fields) <= 1000) {
    return [];
  }
  const { schemaName, className } = parseFullClassName(classFullName);
  return descriptor.fields.filter((field): field is NestedContentField => {
    if (!field.isNestedContentField() || field.pathToPrimaryClass.length !== 1) {
      return false;
    }
    const step = field.pathToPrimaryClass[0];
    return (
      !step.isForwardRelationship &&
      (step.relationshipInfo.name === "BisCore:ElementOwnsMultiAspects" || step.relationshipInfo.name === "BisCore:ElementOwnsUniqueAspect") &&
      step.sourceClassInfo.id === field.contentClassInfo.id &&
      step.targetClassInfo.name === `${schemaName}:${className}`
    );
  });
}

function countFields(fields: Field[]): number {
  return fields.reduce((count, field) => count + 1 + (field.isNestedContentField() ? countFields(field.nestedFields) : 0), 0);
}

async function selectBatchAspectFields(imodel: IModelDb, descriptor: Descriptor, aspectFields: NestedContentField[], batch: Id64Array): Promise<void> {
  const query = `
    WITH aspectClasses(ClassId) AS (
      SELECT DISTINCT a.ECClassId
      FROM bis.ElementMultiAspect a
      JOIN IdSet(:elementIds) e ON e.id = a.Element.Id
      UNION ALL
      SELECT DISTINCT a.ECClassId
      FROM bis.ElementUniqueAspect a
      JOIN IdSet(:elementIds) e ON e.id = a.Element.Id
    )
    SELECT IdToHex(b.TargetECInstanceId) classId
    FROM meta.ClassHasAllBaseClasses b
    JOIN aspectClasses a ON a.ClassId = b.SourceECInstanceId
  `;
  const aspectClasses = new Set<Id64String>();
  for await (const row of imodel.createQueryReader(query, QueryBinder.from({ elementIds: batch }))) {
    aspectClasses.add(row.classId);
  }
  const excludedFields = aspectFields.filter((field) => !aspectClasses.has(field.contentClassInfo.id));
  if (excludedFields.length > 0) {
    descriptor.fieldsSelector = { type: "exclude", fields: excludedFields.map((field) => field.getFieldDescriptor()) };
  }
}

function createClassContentRuleset(fullClassName: string): Ruleset {
  const { schemaName, className } = parseFullClassName(fullClassName);
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
      return from(
        imodel.createQueryReader(
          `
            SELECT ec_classname(e.ECClassId) className, GROUP_CONCAT(IdToHex(e.ECInstanceId)) ids
            FROM bis.Element e
            WHERE e.ECInstanceId IN (${elementIds.slice(idsFrom, idsTo).join(",")})
            GROUP BY e.ECClassId
          `,
        ),
      );
    }),
    map((row: QueryRowProxy): { className: string; ids: Id64Array } => ({
      className: row.className,
      ids: row.ids.split(","),
    })),
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

/** Given a list of full class names, get concrete class names with instances. */
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

interface ElementIdBatch {
  ids: Id64Array;
  ranges: Array<{ from: Id64String; to: Id64String }>;
}

/**
 * Given a sorted list of ECInstanceIds and a batch size, create a stream of batches. Because the IDs won't necessarily
 * be sequential, a batch is defined a list of from-to pairs. Ranges combine consecutive local IDs within the same briefcase.
 * @internal
 */
export function createIdBatches(sortedIds: Id64String[], batchSize: number): Observable<ElementIdBatch> {
  return range(0, sortedIds.length / batchSize).pipe(
    map((batchIndex) => {
      const ranges = new Array<{ from: Id64String; to: Id64String }>();
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min((batchIndex + 1) * batchSize, sortedIds.length) - 1;
      let fromId = sortedIds[startIndex];
      let to = {
        id: sortedIds[startIndex],
        localId: Id64.getLocalId(sortedIds[startIndex]),
      };
      for (let i = startIndex + 1; i <= endIndex; ++i) {
        const currLocalId = Id64.getLocalId(sortedIds[i]);
        if (Id64.getBriefcaseId(sortedIds[i]) !== Id64.getBriefcaseId(to.id) || currLocalId !== to.localId + 1) {
          ranges.push({ from: fromId, to: sortedIds[i - 1] });
          fromId = sortedIds[i];
        }
        to = { id: sortedIds[i], localId: currLocalId };
      }
      ranges.push({ from: fromId, to: sortedIds[endIndex] });
      return { ids: sortedIds.slice(startIndex, endIndex + 1), ranges };
    }),
  );
}

function getBatchedClassElementIds(imodel: IModelDb, fullClassName: string, batchSize: number): Observable<ElementIdBatch> {
  return from(imodel.createQueryReader(`SELECT IdToHex(ECInstanceId) id FROM ONLY ${getECSqlName(fullClassName)} ORDER BY ECInstanceId`)).pipe(
    map((row): Id64String => row.id),
    bufferCount(batchSize),
    map((ids) => ({ ids, ranges: [{ from: ids[0], to: ids[ids.length - 1] }] })),
  );
}

/** @internal */
export async function getElementsCount(db: IModelDb, classNames: string[]) {
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
    return `e.ECClassId IS (${classNames.map(getECSqlName).join(",")})`;
  })();
  const query = `
    SELECT COUNT(e.ECInstanceId) AS elementCount
    FROM bis.Element e
    ${whereClause ? `WHERE ${whereClause}` : ""}
  `;
  for await (const row of db.createQueryReader(query)) {
    return row.elementCount;
  }
  return 0;
}
