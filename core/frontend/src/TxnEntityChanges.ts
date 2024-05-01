/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { CompressedId64Set, Id64String } from "@itwin/core-bentley";
import { NotifyEntitiesChangedArgs } from "@itwin/core-common";

/** Describes the BIS class of a [[TxnEntityChange]].
 * @public
 * @extensions
 */
export interface TxnEntityMetadata {
  /** The class's name in "Schema:Class" format. */
  readonly classFullName: string;

  /** Returns true if this class is or is derived from the specified class.
   * @note Class names are compared case-sensitively.
   */
  is(baseClassFullName: string): boolean;
}

/** The type of operation that produced a [[TxnEntityChange]].
 * @public
 * @extensions
 */
export type TxnEntityChangeType = "inserted" | "deleted" | "updated";

/** Represents a single change to a single [Entity]($backend), as part of a collection of [[TxnEntityChanges]].
 * @public
 * @extensions
 */
export interface TxnEntityChange {
  /** The operation that produced the change. */
  type: TxnEntityChangeType;
  /** The Id of the affected entity. */
  id: Id64String;
  /** A representation of the BIS class of the affected entity. */
  metadata: TxnEntityMetadata;
}

/** A collection of [[TxnEntityChange]]s.
 * @public
 * @extensions
 */
export type TxnEntityChangeIterable = Iterable<Readonly<TxnEntityChange>>;

/** A function that returns `true` if a particular BIS [Entity]($backend) class should be included when iterating a [[TxnEntityChangeIterable]].
 * For example, you may wish to include only elements deriving from "BisCore:GeometricElement", which you can determine by using [[TxnEntityMetadata.is]].
 * @see [[TxnEntityChangesFilterOptions.includeMetadata]] to supply such a criterion to [[TxnEntityChanges.filter]].
 * @public
 * @extensions
 */
export type TxnEntityMetadataCriterion = (metadata: TxnEntityMetadata) => boolean;

/** Options defining criteria by which to filter the contents of a [[TxnEntityChanges]].
 * @public
 * @extensions
 */
export interface TxnEntityChangesFilterOptions {
  /** Permits filtering based on metadata. For example, you may wish to include only elements deriving from "BisCore:GeometricElement",
   * which you can determine by using [[TxnEntityMetadata.is]].
   * Only entities with metadata for which this function returns `true` will be included in the iteration.
   */
  includeMetadata?: TxnEntityMetadataCriterion;

  /** Permits filtering based on the type of change. For example, you may only care about newly-inserted entities, in which case you would specify `["inserted"]`.
   * Only changes of the specified type(s) will be included in the iteration.
   */
  includeTypes?: TxnEntityChangeType[];
}

/** Describes a set of elements or models that were modified as part of a transaction in a [[BriefcaseConnection]],
 * serving as the payload for the [[BriefcaseTxns.onElementsChanged]] and [[BriefcaseTxns.onModelsChanged]] events.
 * The [[inserted]], [[deleted]], and [[updated]] compressed Id sets can be awkward to work with.
 * It can be more convenient to iterate over the individual [[TxnEntityChange]]s, especially if you with to [[filter]] out some
 * changes.
 * @public
 * @extensions
 */
export interface TxnEntityChanges extends TxnEntityChangeIterable {
  /** The ids of entities that were inserted during the Txn. */
  readonly inserted?: CompressedId64Set;
  /** The ids of entities that were deleted during the Txn. */
  readonly deleted?: CompressedId64Set;
  /** The ids of entities that were modified during the Txn, including any [Element]($backend)s for which one of their [ElementAspect]($backend)s was changed. */
  readonly updated?: CompressedId64Set;

  /** Obtain an iterator over changes meeting the criteria specified by `options`. */
  filter(options: TxnEntityChangesFilterOptions): TxnEntityChangeIterable;
}

export class Metadata implements TxnEntityMetadata {
  public readonly classFullName: string;
  public readonly baseClasses: Metadata[] = [];

  public constructor(name: string) {
    this.classFullName = name;
  }

  public is(baseName: string): boolean {
    return baseName === this.classFullName || this.baseClasses.some((base) => base.is(baseName));
  }
}

function * entityChangesIterator(changes: EntityChanges, options?: TxnEntityChangesFilterOptions): Iterator<TxnEntityChange> {
  let excludedMetaIndices: Set<number> | undefined;
  if (options?.includeMetadata) {
    for (let i = 0; i < changes.metadata.length; i++) {
      if (!options.includeMetadata(changes.metadata[i])) {
        excludedMetaIndices = excludedMetaIndices ?? new Set<number>();
        excludedMetaIndices.add(i);
      }
    }
  }

  function * process(type: TxnEntityChangeType) {
    if (options?.includeTypes && !options.includeTypes.includes(type)) {
      return;
    }

    const ids = changes[type];
    if (undefined === ids) {
      return;
    }

    const metaIndices = changes.args[`${type}Meta`];
    let index = 0;
    for (const id of CompressedId64Set.iterable(ids)) {
      const metaIndex = metaIndices[index++];
      if (excludedMetaIndices && excludedMetaIndices.has(metaIndex)) {
        continue;
      }

      const metadata = changes.metadata[metaIndex];
      yield { type, id, metadata };
    }
  }

  yield* process("inserted");
  yield* process("deleted");
  yield* process("updated");
}

export class EntityChanges implements TxnEntityChanges {
  public readonly args: NotifyEntitiesChangedArgs;
  public readonly metadata: Metadata[];

  public constructor(args: NotifyEntitiesChangedArgs) {
    this.args = args;

    this.metadata = args.meta.map((x) => new Metadata(x.name));
    for (let i = 0; i < this.metadata.length; i++) {
      const meta = this.metadata[i];
      for (const baseIndex of args.meta[i].bases) {
        meta.baseClasses.push(this.metadata[baseIndex]);
      }
    }
  }

  public get inserted(): CompressedId64Set | undefined { return this.args.inserted; }
  public get deleted(): CompressedId64Set | undefined { return this.args.deleted; }
  public get updated(): CompressedId64Set | undefined { return this.args.updated; }

  public [Symbol.iterator](): Iterator<TxnEntityChange> {
    return entityChangesIterator(this);
  }

  public filter(options: TxnEntityChangesFilterOptions): TxnEntityChangeIterable {
    return {
      [Symbol.iterator]: () => entityChangesIterator(this, options),
    };
  }
}
