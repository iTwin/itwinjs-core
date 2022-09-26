/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { Id64String } from "@itwin/core-bentley";

/**
 * A reference relationships from an element, "referencer", to an element or its submodel, "referenced"
 * @internal
 */
interface PendingReference {
  referencer: Id64String;
  referenced: Id64String;
  isModelRef: boolean;
}

namespace PendingReference {
  export function toKey(props: PendingReference): string {
    return `${props.isModelRef ? "1" : "0"}${props.referencer}\x00${props.referenced}`;
  }

  const keyPattern = /(?<isModelRef>0|1)(?<referencer>0x[0-9a-f])\x00(?<referenced>0x[0-9a-f])/;

  export function fromKey(key: string): PendingReference {
    const match = keyPattern.exec(key);
    if (match === null || match.groups === undefined)
      throw Error("invalid key passed");
    return {
      isModelRef: match.groups.isModelRef === "1",
      referencer: match.groups.referencer,
      referenced: match.groups.referenced,
    };
  }
}

/**
 * a map that supports using PendingReferences objects as structural keys,
 * as well as getting a list of referencers from a referencee (called referenced)
 */
export class PendingReferenceMap<T> implements Map<PendingReference, T> {
  private _map = new Map<string, T>();
  private _referencedToReferencers = new Map<Id64String, Set<Id64String>>();

  public getReferencers(referenced: Id64String): Set<Id64String> {
    let referencers = this._referencedToReferencers.get(referenced);
    if (referencers === undefined) {
      // lazy add an empty entry if there wasn't one
      referencers = new Set();
      this._referencedToReferencers.set(referenced, referencers);
    }
    return referencers;
  }

  /// Map implementation

  public clear(): void { this._map.clear(); }
  public delete(ref: PendingReference): boolean {
    const deleteResult = this._map.delete(PendingReference.toKey(ref));
    const referencers = this._referencedToReferencers.get(ref.referenced);
    if (referencers !== undefined)
      referencers.delete(ref.referencer);
    return deleteResult;
  }
  public forEach(callbackfn: (value: T, key: PendingReference, map: Map<PendingReference, T>) => void, thisArg?: any): void {
    for (const [key, val] of this._map)
      callbackfn.call(thisArg, val, PendingReference.fromKey(key), this);
  }
  public get(ref: PendingReference): T | undefined {
    return this._map.get(PendingReference.toKey(ref));
  }
  public has(ref: PendingReference): boolean {
    return this._map.has(PendingReference.toKey(ref));
  }
  public set(ref: PendingReference, value: T): this {
    this._map.set(PendingReference.toKey(ref), value);
    let referencers = this._referencedToReferencers.get(ref.referenced);
    if (referencers === undefined) {
      referencers = new Set();
      this._referencedToReferencers.set(ref.referenced, referencers);
    }
    referencers.add(ref.referencer);
    return this;
  }
  public get size(): number { return this._map.size; }
  public entries(): IterableIterator<[PendingReference, T]> {
    return this[Symbol.iterator]();
  }
  public *keys(): IterableIterator<PendingReference> {
    for (const key of this._map.keys())
      yield PendingReference.fromKey(key);
  }
  public values(): IterableIterator<T> {
    return this._map.values();
  }
  public *[Symbol.iterator](): IterableIterator<[PendingReference, T]> {
    for (const [key, val] of this._map)
      yield [PendingReference.fromKey(key), val];
  }
  public get [Symbol.toStringTag](): string { return "PendingReferenceMap"; }
}
