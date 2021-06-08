/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { CompressedId64Set, Id64Array, Id64String } from "@bentley/bentleyjs-core";

export interface EntityIdAndClassId {
  id: Id64String;
  classId: Id64String;
}

/** The set of elements or models that were changed by a [Txn]($docs/learning/InteractiveEditing.md)
 * @note this object holds lists of ids of elements or models that were modified somehow during the Txn. Any modifications to an [[ElementAspect]]($backend) will
 * cause its element to appear in these lists.
 * @see [TxnManager.onElementsChanged]($backend) and [TxnManager.onModelsChanged]($backend).
 * @see [BriefcaseTxns.onElementsChanged]($frontend) and [BriefcaseTxns.onModelsChanged]($frontend).
 * @public
 */
export interface ChangedEntities {
  /** The ids of entities that were inserted during this Txn */
  inserted?: CompressedId64Set;
  /** The ids of entities that were deleted during this Txn */
  deleted?: CompressedId64Set;
  /** The ids of entities that were modified during this Txn */
  updated?: CompressedId64Set;

  classIds?: Id64Array;
  insertedClassIndices?: number[];
  deletedClassIndices?: number[];
  updatedClassIndices?: number[];
}

function * entityIterator(classIds: Id64Array | undefined, entityIds: CompressedId64Set | undefined, classIndices: number[] | undefined): Iterator<Readonly<EntityIdAndClassId>> {
  if (!classIds || !entityIds || !classIndices)
    return;

  let index = 0;
  const entity: EntityIdAndClassId = { id: "", classId: "" };
  for (const id of CompressedId64Set.iterable(entityIds)) {
    const classIndex = classIndices[index++];
    const classId = undefined !== classIndex ? classIds[classIndex] : undefined;
    if (classId) {
      entity.id = id;
      entity.classId = classId;
      yield entity;
    }
  }
}

function entityIterable(classIds: Id64Array | undefined, entityIds: CompressedId64Set | undefined, classIndices: number[] | undefined): Iterable<Readonly<EntityIdAndClassId>> {
  return {
    [Symbol.iterator]: () => entityIterator(classIds, entityIds, classIndices),
  };
}

export interface ChangedEntitiesIterable {
  readonly inserted: Iterable<Readonly<EntityIdAndClassId>>;
  readonly deleted: Iterable<Readonly<EntityIdAndClassId>>;
  readonly updated: Iterable<Readonly<EntityIdAndClassId>>;
}

export namespace ChangedEntitiesIterable {
  export function create(props: ChangedEntities): ChangedEntitiesIterable {
    return {
      inserted: entityIterable(props.classIds, props.inserted, props.insertedClassIndices),
      deleted: entityIterable(props.classIds, props.deleted, props.deletedClassIndices),
      updated: entityIterable(props.classIds, props.updated, props.updatedClassIndices),
    };
  }
}
