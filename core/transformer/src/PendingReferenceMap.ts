/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";

interface PendingReferenceProps {
  referencer: Id64String;
  referenced: Id64String;
  isModelRef: boolean;
}

/** A reference that may need */
export class PendingReference implements PendingReferenceProps {
  public referencer!: Id64String;
  public referenced!: Id64String;
  public isModelRef!: boolean;
  constructor(props: PendingReferenceProps) {
    Object.assign(this, props);
  }
  public toKey(): string {
    return `${this.isModelRef ? "1" : "0"}${this.referencer}\x00${this.referenced}`;
  }
  private static keyPattern = /(?<isModelRef>0|1)(?<referencer>0x[0-9a-f])\x00(?<referenced>0x[0-9a-f])/;
  public static fromKey(key: string): PendingReference {
    const match = this.keyPattern.exec(key);
    if (match === null || match.groups === undefined)
      throw Error("invalid key passed");
    return new PendingReference({
      isModelRef: match.groups.isModelRef === "1",
      referencer: match.groups.referencer,
      referenced: match.groups.referenced,
    });
  }
}

/**
 * a map that supports using PendingReferences objects as structural keys,
 * as well as getting a list of referencers from a referencee (called referenced)
 */
export class PendingReferenceMap<T> implements Map<PendingReferenceProps, T> {
  private _map = new Map<string, T>();
  private _referencedToReferencers = new Map<Id64String, Set<Id64String>>();

  public getReferencers(referenced: Id64String): Set<Id64String> {
    let referencers = this._referencedToReferencers.get(referenced);
    if (referencers === undefined) {
      referencers = new Set();
      this._referencedToReferencers.set(referenced, referencers);
    }
    return referencers;
  }

  private static promoteRef(ref: PendingReferenceProps | PendingReference): PendingReference {
    if (ref instanceof PendingReference)
      return ref;
    return new PendingReference(ref);
  }

  /// Map implementation

  public clear(): void { this._map.clear(); }
  public delete(ref: PendingReferenceProps): boolean {
    const promotedRef = PendingReferenceMap.promoteRef(ref);
    const deleteResult = this._map.delete(promotedRef.toKey());
    const referencers = this._referencedToReferencers.get(ref.referenced);
    if (referencers !== undefined)
      referencers.delete(ref.referencer);
    return deleteResult;
  }
  public forEach(callbackfn: (value: T, key: PendingReferenceProps, map: Map<PendingReferenceProps, T>) => void, thisArg?: any): void {
    for (const [key, val] of this._map)
      callbackfn.call(thisArg, val, PendingReference.fromKey(key), this);
  }
  public get(ref: PendingReferenceProps): T | undefined {
    const promotedRef = PendingReferenceMap.promoteRef(ref);
    return this._map.get(promotedRef.toKey());
  }
  public has(ref: PendingReferenceProps): boolean {
    const promotedRef = PendingReferenceMap.promoteRef(ref);
    return this._map.has(promotedRef.toKey());
  }
  public set(ref: PendingReferenceProps, value: T): this {
    const promotedRef = PendingReferenceMap.promoteRef(ref);
    this._map.set(promotedRef.toKey(), value);
    let referencers = this._referencedToReferencers.get(ref.referenced);
    if (referencers === undefined) {
      referencers = new Set();
      this._referencedToReferencers.set(ref.referenced, referencers);
    }
    referencers.add(ref.referencer);
    return this;
  }
  public get size(): number { return this._map.size; }
  public entries(): IterableIterator<[PendingReferenceProps, T]> {
    return this[Symbol.iterator]();
  }
  public *keys(): IterableIterator<PendingReferenceProps> {
    for (const key of this._map.keys())
      yield PendingReference.fromKey(key);
  }
  public values(): IterableIterator<T> {
    return this._map.values();
  }
  public *[Symbol.iterator](): IterableIterator<[PendingReferenceProps, T]> {
    for (const [key, val] of this._map)
      yield [PendingReference.fromKey(key), val];
  }
  public get [Symbol.toStringTag](): string { return "PendingReferenceMap"; }
}
