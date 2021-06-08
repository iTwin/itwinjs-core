/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { CompressedId64Set, Id64Array, Id64String } from "@bentley/bentleyjs-core";

/** Describes an [Entity]($backend) and its [ECClass]($docs/bis/intro/glossary/#ecclass) by Id.
 * @public
 */
export interface EntityIdAndClassId {
  /** The entity's Id. */
  id: Id64String;
  /** The Id of the entity's ECClass. */
  classId: Id64String;
}

/** JSON representation of the set of [Element]($backend)s or [Model]($backend)s that were changed by a [Txn]($docs/learning/InteractiveEditing.md).
 * @note The presence of an element indicates either a direct change to that element, or a change to one of its [ElementAspect]($backend)s.
 * @see [[ChangedEntitiesIterable]] to iterate the [[EntityIdAndClassId]] pairs represented by this object.
 * @see [TxnManager.onElementsChanged]($backend) and [TxnManager.onModelsChanged]($backend).
 * @see [BriefcaseTxns.onElementsChanged]($frontend) and [BriefcaseTxns.onModelsChanged]($frontend).
 * @public
 */
export interface ChangedEntities {
  /** The ids of entities that were inserted during the Txn. */
  inserted?: CompressedId64Set;
  /** The ids of entities that were deleted during the Txn. */
  deleted?: CompressedId64Set;
  /** The ids of entities that were modified during the Txn. */
  updated?: CompressedId64Set;

  /** An array of the Ids of the [ECClass]($docs/bis/intro/glossary/#ecclass)es of the entities in this object, indexed by [[insertedClassIndices]], [[deletedClassIndices]], and [[updatedClassIndices]].
   * @see [[ChangedEntitiesIterable]] for a much more ergonomic API.
   */
  classIds?: Id64Array;

  /** Indices into [[classIds]] ordered such that the nth entry identifies the ECClass of the nth Id in [[inserted]].
   * @see [[ChangedEntitiesIterable]] for a much more ergonomic API.
   */
  insertedClassIndices?: number[];
  /** Indices into [[classIds]] ordered such that the nth entry identifies the ECClass of the nth Id in [[deleted]].
   * @see [[ChangedEntitiesIterable]] for a much more ergonomic API.
   */
  deletedClassIndices?: number[];
  /** Indices into [[classIds]] ordered such that the nth entry identifies the ECClass of the nth Id in [[updated]].
   * @see [[ChangedEntitiesIterable]] for a much more ergonomic API.
   */
  updatedClassIndices?: number[];
}

/** A collection of [[EntityIdAndClassId]]s, as used by [[ChangedEntitiesIterable]].
 * For efficiency, the iterator supplied by this iterable returns **the same `EntityIdAndClassId` object** on each iteration. Therefore the objects must be copied if you
 * intend to store references to them. For example, to populate an array from the iterable:
 * ```ts
 *  function arrayFromIterable(entities: EntityIdAndClassIdIterable): EntityIdAndClassId[] {
 *    // NO! return Array.from(entities);
 *    const array = [];
 *    for (const entity of entities)
 *      array.push({...entity});
 *
 *    return array;
 *  }
 * ```
 * @public
 */
export type EntityIdAndClassIdIterable = Iterable<Readonly<EntityIdAndClassId>>;

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

function entityIterable(classIds: Id64Array | undefined, entityIds: CompressedId64Set | undefined, classIndices: number[] | undefined): EntityIdAndClassIdIterable {
  return {
    [Symbol.iterator]: () => entityIterator(classIds, entityIds, classIndices),
  };
}

/** Provides iteration over the data represented by [[ChangedEntities]].
 * @see [[ChangedEntitiesIterable.create]] to create an iterable.
 * @public
 */
export interface ChangedEntitiesIterable {
  /** The entities that were inserted by the Txn. */
  readonly inserted: EntityIdAndClassIdIterable;
  /** The entities that were deleted by the Txn. */
  readonly deleted: EntityIdAndClassIdIterable;
  /** The entities that were updated by the Txn. */
  readonly updated: EntityIdAndClassIdIterable;
}

/** @public */
export namespace ChangedEntitiesIterable {
  /** Create an iterable over the supplied [[ChangedEntities]]. */
  export function create(props: ChangedEntities): ChangedEntitiesIterable {
    return {
      inserted: entityIterable(props.classIds, props.inserted, props.insertedClassIndices),
      deleted: entityIterable(props.classIds, props.deleted, props.deletedClassIndices),
      updated: entityIterable(props.classIds, props.updated, props.updatedClassIndices),
    };
  }
}
