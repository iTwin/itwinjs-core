/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { CompressedId64Set, Id64String } from "@itwin/core-bentley";

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
 * @see [TxnManager.onElementsChanged]($backend) and [TxnManager.onModelsChanged]($backend).
 * @see [BriefcaseTxns.onElementsChanged]($frontend) and [BriefcaseTxns.onModelsChanged]($frontend).
 * @public
 */
export interface ChangedEntities {
  /** The ids of entities that were inserted during the Txn. */
  inserted?: CompressedId64Set;
  /** The ids of entities that were deleted during the Txn. */
  deleted?: CompressedId64Set;
  /** The ids of entities that were modified during the Txn, including any [Element]($backend)s for which one of their [ElementAspect]($backend)s was changed. */
  updated?: CompressedId64Set;
}

/** A collection of [[EntityIdAndClassId]]s, as used by [TxnChangedEntities]($backend).
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
