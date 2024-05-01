/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { CompressedId64Set, Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import { ChangedEntities, NotifyEntitiesChangedArgs, NotifyEntitiesChangedMetadata } from "@itwin/core-common";

export interface TxnEntityMetadata {
  readonly classFullName: string;

  is(baseClassFullName: string): boolean;
}

export type TxnEntityChangeType = "inserted" | "deleted" | "updated";

export interface TxnEntityChange {
  type: TxnEntityChangeType;
  id: Id64String;
  metadata: TxnEntityMetadata;
}

export type TxnEntityChangeIterable = Iterable<Readonly<TxnEntityChange>>;

export type TxnEntityMetadataCriterion = (metadata: TxnEntityMetadata) => boolean;

export interface TxnEntityChangesFilterOptions {
  includeMetadata?: TxnEntityMetadataCriterion;
  includeTypes?: TxnEntityChangeType[];
}

export interface TxnEntityChanges extends ChangedEntities, TxnEntityChangeIterable {
  filter(options: TxnEntityChangesFilterOptions): TxnEntityChangeIterable;
}

/** @internal */
export function createTxnEntityChanges(args: NotifyEntitiesChangedArgs): TxnEntityChanges {
  return new EntityChanges(args);
}

class Metadata implements TxnEntityMetadata {
  public readonly classFullName: string;
  public readonly baseClasses: Metadata[] = [];

  public constructor(name: string) {
    this.classFullName = name;
  }

  public is(baseName: string): boolean {
    return baseName === this.classFullName || this.baseClasses.some((base) => base.is(baseName));
  }
}

function * entityChangesIterator(changes: EntityChanges, options?: TxnEntityChangesFilterOptions) {
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
      const metadata = changes.metadata[metaIndex];
      yield { type, id, metadata };
    }
  }
  
  process("inserted");
  process("deleted");
  process("updated");
}

class EntityChanges implements TxnEntityChanges {
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

  public [Symbol.iterator](): Iterator<Readonly<TxnEntityChange>> {
    return entityChangesIterator(this);
  }

  public filter(options: TxnEntityChangesFilterOptions): TxnEntityChangeIterable {
    return entityChangesIterator(this, options);
  }
}
