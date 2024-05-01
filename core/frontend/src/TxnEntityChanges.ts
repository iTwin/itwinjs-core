/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { CompressedId64Set, Id64String } from "@itwin/core-bentley";
import { ChangedEntities, NotifyEntitiesChangedArgs } from "@itwin/core-common";

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
  return new TxnEntityChangesImpl(args);
}

class TxnEntityChangesImpl implements TxnEntityChanges {
  public inserted: CompressedId64Set;
  public deleted: CompressedId64Set;
  public updated: CompressedId64Set;

  public constructor(args: NotifyEntitiesChangedArgs) {
    this.inserted = args.inserted ?? "";
    this.deleted = args.deleted ?? "";
    this.updated = args.updated ?? "";
  }

  public [Symbol.iterator](): Iterator<Readonly<TxnEntityChange>> {
    throw new Error("###TODO)");
  }

  public filter(_options: TxnEntityChangesFilterOptions): TxnEntityChangeIterable {
    throw new Error("###TODO");
  }
}
