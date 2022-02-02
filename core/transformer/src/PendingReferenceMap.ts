/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";

interface PendingReferenceProps {
  referencer: Id64String;
  referencee: Id64String;
  isModelRef: boolean;
}

/** A reference that may need */
export class PendingReference implements PendingReferenceProps {
  public referencer!: Id64String;
  public referencee!: Id64String;
  public isModelRef!: boolean;
  constructor(props: PendingReferenceProps) {
    Object.assign(this, props);
  }
  public toKey(): string {
    return `${this.isModelRef ? "1" : "0"}${this.referencer}\x00${this.referencee}`;
  }
  private static keyPattern = /(?<isModelRef>)0|1)(?<referencer>0x[0-9a-f])\x00(?<referencee>0x[0-9a-f])/;
  public static fromKey(key: string): PendingReference {
    const match = this.keyPattern.exec(key);
    if (match === null || match.groups === undefined)
      throw Error("invalid key passed");
    return new PendingReference({
      isModelRef: match.groups.isModelRef === "1",
      referencer: match.groups.referencer,
      referencee: match.groups.referencee,
    });
  }
}

/**
 * a map with PendingReferences keys
 */
export class PendingReferenceMap<T> implements Map<PendingReferenceProps, T> {
  private _map = new Map<string, T>();

  public clear(): void { this._map.clear(); }
  public delete(ref: PendingReference): boolean {
    return this._map.delete(ref.toKey());
  }
  public forEach(callbackfn: (value: T, key: PendingReference, map: Map<PendingReference, T>) => void, thisArg?: any): void {
    for (const [key, val] of this._map)
      callbackfn.call(thisArg, val, PendingReference.fromKey(key), this);
  }
  public get(ref: PendingReference): T | undefined {
    return this._map.get(ref.toKey());
  }
  public has(ref: PendingReference): boolean {
    return this._map.has(ref.toKey());
  }
  public set(ref: PendingReference, value: T): this {
    this._map.set(ref.toKey(), value);
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
