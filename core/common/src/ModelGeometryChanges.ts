/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { assert, CompressedId64Set, DbOpcode, GuidString, Id64String } from "@bentley/bentleyjs-core";
import { Range3d, Range3dProps } from "@bentley/geometry-core";

/** The set of elements that were changed for a Txn in an [interactive editing session]($docs/learning/InteractiveEditing.md)
 * @note this object holds lists of ids of elements that were modified somehow during the Txn. Any modifications to [[ElementAspect]]($backend)s will
 * cause its element to appear in these lists.
 * @alpha
 */
export interface ElementsChanged {
  /** The ids of elements that were inserted during this Txn */
  inserted?: CompressedId64Set;
  /** The ids of elements that were deleted during this Txn */
  deleted?: CompressedId64Set;
  /** The ids of elements that were modified during this Txn */
  updated?: CompressedId64Set;
}

/** Compact wire format representing geometric changes to a set of elements as part of a [[ModelGeometryChangesProps]].
 * All of the elements belong to the same model.
 * The number of [[ids]] and [[ranges]] are guaranteed to be the same.
 * @see [[ElementGeometryChange]] for a more useful representation of an individual element change.
 * @see [[ModelGeometryChanges.iterable]] to iterate over [[ElementGeometryChange]]s.
 * @alpha
 */
export interface ElementIdsAndRangesProps {
  /** The Ids of the elements, compressed and sorted in ascending order. */
  readonly ids: CompressedId64Set;
  /** The range of each element, indexed by the position of the corresponding element's Id in [[ids]]. */
  readonly ranges: Range3dProps[];
}

/** Compact wire format representing geometric changes to [GeometricElement]($backend)s within a [GeometricModel]($backend).
 * A given element Id will appear in no more than one of [[inserted]], [[updated]], or [[deleted]].
 * @see [[ModelGeometryChanges]] for a more useful representation.
 * @alpha
 */
export interface ModelGeometryChangesProps {
  /** The Id of the model. */
  readonly id: Id64String;
  /** The range of the model. */
  readonly range: Range3dProps;
  /** The geometry GUID of the model. */
  readonly guid: GuidString;
  /** If defined, the Ids and ranges of newly-inserted [GeometricElement]($backend)s. */
  readonly inserted?: ElementIdsAndRangesProps;
  /** If defined, the Ids and ranges of [GeometricElement]($backend)s whose geometric properties were modified. */
  readonly updated?: ElementIdsAndRangesProps;
  /** If defined, the Ids of deleted [GeometricElement]($backend)s. */
  readonly deleted?: CompressedId64Set;
}

/** Represents the insertion of a new [GeometricElement]($backend), or a change to the geometric properties of an existing [GeometricElement]($backend).
 * @see [[ElementGeometryChange]].
 * @alpha
 */
export interface ExtantElementGeometryChange {
  /** Indicates whether this change resulted from the insertion of a new element or modification of an existing one.
   * Used as discriminant for [[ElementGeometryChange]] union.
   */
  readonly type: DbOpcode.Insert | DbOpcode.Update;
  /** The element's Id. */
  readonly id: Id64String;
  /** The element's range. */
  readonly range: Range3d;
}

/** Represents the deletion of a [GeometricElement]($backend).
 * @see [[ElementGeometryChange]].
 * @alpha
 */
export interface DeletedElementGeometryChange {
  /** Discriminant for [[ElementGeometryChange]] union. */
  readonly type: DbOpcode.Delete;
  /** The element's Id. */
  readonly id: Id64String;
}

/** Represents a change to the geometry of a [GeometricElement]($backend).
 * @alpha
 */
export type ElementGeometryChange = ExtantElementGeometryChange | DeletedElementGeometryChange;

/** Represents a change to the geometry of a [GeometricElement]($backend).
 * @alpha
 */
export namespace ElementGeometryChange { // eslint-disable-line @typescript-eslint/no-redeclare
  function* extantIterator(props: ElementIdsAndRangesProps, type: DbOpcode.Insert | DbOpcode.Update): Iterator<ElementGeometryChange> {
    let index = 0;
    const ids = CompressedId64Set.iterable(props.ids);
    for (const id of ids) {
      assert(undefined !== props.ranges[index]);
      const range = Range3d.fromJSON(props.ranges[index]);
      index++;
      yield { type, id, range };
    }
  }

  function extantIterable(props: ElementIdsAndRangesProps, type: DbOpcode.Insert | DbOpcode.Update): Iterable<ElementGeometryChange> {
    return { [Symbol.iterator]: () => extantIterator(props, type) };
  }

  /** Obtain an iterator over the geometry changes for a single [GeometricModel]($backend). A given element will appear at most once. */
  export function* iterator(modelChanges: ModelGeometryChangesProps): Iterator<ElementGeometryChange> {
    if (modelChanges.inserted)
      yield* extantIterable(modelChanges.inserted, DbOpcode.Insert);

    if (modelChanges.updated)
      yield* extantIterable(modelChanges.updated, DbOpcode.Update);

    if (modelChanges.deleted)
      for (const id of CompressedId64Set.iterable(modelChanges.deleted))
        yield { type: DbOpcode.Delete, id };
  }

  /** Obtain an iterable over the geometry changes for a single [GeometricModel]($backend). A given element will appear at most once. */
  export function iterable(modelChanges: ModelGeometryChangesProps): Iterable<ElementGeometryChange> {
    return { [Symbol.iterator]: () => iterator(modelChanges) };
  }
}

/** Represents geometric changes to a set of [GeometricElement]($backend)s belonging to a single [GeometricModel]($backend).
 * @alpha
 */
export interface ModelGeometryChanges {
  /** The model's Id. */
  readonly id: Id64String;
  /** The model's geometry GUID. */
  readonly geometryGuid: GuidString;
  /** The model's range. */
  readonly range: Range3d;
  /** The individual geometric element changes. */
  readonly elements: Iterable<ElementGeometryChange>;
}

/** Represents geometric changes to a set of [GeometricElement]($backend)s belonging to a single [GeometricModel]($backend).
 * @alpha
 */
export namespace ModelGeometryChanges {
  /** Obtain an iterator over the geometry changes for a set of models. A given model will appear at most once. */
  export function* iterator(modelChanges: ModelGeometryChangesProps[]): Iterator<ModelGeometryChanges> {
    for (const props of modelChanges)
      yield fromJSON(props);
  }

  /** Obtain an iterable over the geometry changes for a set of models. A given model will appear at most once. */
  export function iterable(modelChanges: ModelGeometryChangesProps[]): Iterable<ModelGeometryChanges> {
    return { [Symbol.iterator]: () => iterator(modelChanges) };
  }

  /** Instantiate from wire format. */
  export function fromJSON(props: ModelGeometryChangesProps): ModelGeometryChanges {
    return {
      id: props.id,
      geometryGuid: props.guid,
      range: Range3d.fromJSON(props.range),
      elements: ElementGeometryChange.iterable(props),
    };
  }

  /** Obtain the ModelGeometryChanges for the specified model Id. */
  export function findByModelId(changes: Iterable<ModelGeometryChanges>, modelId: Id64String): ModelGeometryChanges | undefined {
    for (const change of changes)
      if (change.id === modelId)
        return change;

    return undefined;
  }
}
