/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { EntityReference } from "@itwin/core-common";
import { ConcreteEntity, EntityReferences } from "@itwin/core-backend";
import { EntityMap } from "./EntityMap";

/**
 * A reference relationships from an element, "referencer", to an element or its submodel, "referenced"
 * @internal
 */
export interface PendingReference {
  referencer: EntityReference;
  referenced: EntityReference;
}

export namespace PendingReference {
  export function from(referencer: ConcreteEntity | EntityReference, referenced: ConcreteEntity | EntityReference): PendingReference {
    if (typeof referencer !== "string")
      referencer = EntityReferences.from(referencer);

    if (typeof referenced !== "string")
      referenced = EntityReferences.from(referenced);

    return { referencer, referenced };
  }

  export function toKey(props: PendingReference): string {
    return `${props.referencer}\x00${props.referenced}`;
  }

  export function fromKey(key: string): PendingReference {
    const [referencer, referenced] = key.split("\x00") as [EntityReference, EntityReference];
    return { referencer, referenced };
  }
}

/**
 * a map that supports using PendingReferences objects as structural keys,
 * as well as getting a list of referencers from a referencee (called referenced)
 */
export class PendingReferenceMap<T> {
  private _map = new Map<string, T>();
  private _referencedToReferencers = new EntityMap<Set<EntityReference>>();

  public getReferencers(referenced: ConcreteEntity): Set<EntityReference> {
    let referencers = this._referencedToReferencers.get(referenced);
    if (referencers === undefined) {
      referencers = new Set();
      this._referencedToReferencers.set(referenced, referencers);
    }
    return referencers;
  }

  /// Map implementation
  public clear(): void { this._map.clear(); }

  public delete(ref: PendingReference): boolean {
    const deleteResult = this._map.delete(PendingReference.toKey(ref));
    const referencedKey = ref.referenced;
    const referencers = this._referencedToReferencers.getByKey(referencedKey);
    if (referencers !== undefined)
      referencers.delete(ref.referencer);
    return deleteResult;
  }

  public get(ref: PendingReference): T | undefined {
    return this._map.get(PendingReference.toKey(ref));
  }

  public has(ref: PendingReference): boolean {
    return this._map.has(PendingReference.toKey(ref));
  }

  public set(ref: PendingReference, value: T): this {
    this._map.set(PendingReference.toKey(ref), value);
    const referencedKey = ref.referenced;
    let referencers = this._referencedToReferencers.getByKey(referencedKey);
    if (referencers === undefined) {
      referencers = new Set();
      this._referencedToReferencers.setByKey(referencedKey, referencers);
    }
    referencers.add(ref.referencer);
    return this;
  }

  public get size(): number { return this._map.size; }

  public get [Symbol.toStringTag](): string { return "PendingReferenceMap"; }
}
