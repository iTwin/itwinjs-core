/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64, GuidString, Guid } from "@bentley/bentleyjs-core";
import { InstanceId, InstanceKey } from "./EC";
import { NodeKey, NodeKeyJSON, nodeKeyFromJSON } from "./hierarchy/Key";
import { EntityProps } from "@bentley/imodeljs-common";
import { PresentationError, PresentationStatus } from "./Error";

/** A single key that identifies something that can be selected */
export type Key = Readonly<NodeKey> | Readonly<InstanceKey> | Readonly<EntityProps>;

/** A type for multiple keys that identify something that can be selected */
export type Keys = ReadonlyArray<Key> | Readonly<KeySetJSON> | Readonly<KeySet>;

/**
 * A data structure of serialized [[KeySet]]
 *
 * @hidden
 */
export interface KeySetJSON {
  instanceKeys: Array<[string, string[]]>;
  nodeKeys: NodeKeyJSON[];
}

/**
 * A class that holds multiple [[Key]] objects. It's basically
 * used as a container that holds multiple keys of different types.
 */
export default class KeySet {
  // note: all keys are stored as strings because we need ability to find them by value
  private _instanceKeys: Map<string, Set<string>>; // class name => instance ids
  private _nodeKeys: Set<string>;
  private _guid: GuidString;

  /**
   * Creates an instance of KeySet.
   * @param source Optional source to initialize from.
   */
  constructor(source?: Keys) {
    this._instanceKeys = new Map();
    this._nodeKeys = new Set();
    this._guid = Guid.createValue();
    if (source)
      this.add(source);
  }

  /**
   * Get a GUID that identifies changes in this keyset. The value
   * does not uniquely identify contents of the keyset, but it can be
   * used to check whether keyset has changed.
   */
  public get guid(): GuidString { return this._guid; }

  /**
   * Serializes this KeySet to JSON
   *
   * @hidden
   */
  public toJSON(): KeySetJSON {
    const instanceKeys = new Array();
    for (const entry of this._instanceKeys.entries())
      instanceKeys.push([entry["0"], [...entry["1"]]]);
    const nodeKeys = new Array<NodeKeyJSON>();
    for (const serializedKey of this._nodeKeys.values())
      nodeKeys.push(JSON.parse(serializedKey));
    return {
      instanceKeys,
      nodeKeys,
    };
  }

  /**
   * Get a map of instance keys stored in this KeySet
   *
   * **Warning**: getting instance keys might be expensive for
   * large KeySets.
   */
  public get instanceKeys(): Map<string, Set<InstanceId>> {
    const map = new Map<string, Set<InstanceId>>();
    for (const entry of this._instanceKeys)
      map.set(entry["0"], new Set([...entry["1"]].map((key: string) => Id64.fromJSON(key))));
    return map;
  }

  /**
   * Get instance keys count
   */
  public get instanceKeysCount(): number {
    let count = 0;
    this._instanceKeys.forEach((set: Set<string>) => count += set.size);
    return count;
  }

  /**
   * Get a set of node keys stored in this KeySet
   *
   * **Warning**: getting node keys might be expensive for
   * large KeySets.
   */
  public get nodeKeys(): Set<NodeKey> {
    const set = new Set<NodeKey>();
    for (const serialized of this._nodeKeys) {
      const key = nodeKeyFromJSON(JSON.parse(serialized));
      set.add(key);
    }
    return set;
  }

  /**
   * Get node keys count
   */
  public get nodeKeysCount(): number {
    return this._nodeKeys.size;
  }

  private isKeySetJSON(set: Keys | Key): set is Readonly<KeySetJSON> {
    return Array.isArray((set as any).nodeKeys) && Array.isArray((set as any).instanceKeys);
  }

  private isKeySet(set: Keys | Key): set is Readonly<KeySet> {
    return (set as any)._nodeKeys && (set as any)._instanceKeys;
  }

  private isKeysArray(keys: Keys | Key): keys is ReadonlyArray<Key> {
    return Array.isArray(keys);
  }

  private isNodeKey(key: Key): key is NodeKey {
    return (key as any).type;
  }

  private isInstanceKey(key: Key): key is InstanceKey {
    return (key as any).className && (key as any).id;
  }

  private isEntityProps(key: Key): key is EntityProps {
    return (key as any).classFullName && (key as any).id;
  }

  /**
   * Clear this KeySet.
   * @returns itself
   */
  public clear(): KeySet {
    if (this.isEmpty)
      return this;

    this._instanceKeys = new Map();
    this._nodeKeys = new Set();
    this._guid = Guid.createValue();
    return this;
  }

  private addKeySet(keyset: Readonly<KeySet>): void {
    for (const key of (keyset as any)._nodeKeys)
      this._nodeKeys.add(key);
    for (const entry of (keyset as any)._instanceKeys) {
      let set = this._instanceKeys.get(entry["0"]);
      if (!set) {
        set = new Set();
        this._instanceKeys.set(entry["0"], set);
      }
      entry["1"].forEach((key: string) => {
        set!.add(key);
      });
    }
  }

  private addKeySetJSON(keyset: Readonly<KeySetJSON>): void {
    for (const key of keyset.nodeKeys)
      this._nodeKeys.add(JSON.stringify(key));
    for (const entry of keyset.instanceKeys)
      this._instanceKeys.set(entry["0"], new Set(entry["1"]));
  }

  /**
   * Add a key or keys to this KeySet.
   * @param value A key or keys to add.
   * @returns itself
   */
  public add(value: Keys | Key): KeySet {
    if (!value)
      throw new PresentationError(PresentationStatus.InvalidArgument, `Invalid argument: value = ${value}`);
    const sizeBefore = this.size;
    if (this.isKeySet(value)) {
      this.addKeySet(value);
    } else if (this.isKeySetJSON(value)) {
      this.addKeySetJSON(value);
    } else if (this.isKeysArray(value)) {
      for (const key of value)
        this.add(key);
    } else if (this.isEntityProps(value)) {
      this.add({ className: value.classFullName, id: Id64.fromJSON(value.id) } as InstanceKey);
    } else if (this.isInstanceKey(value)) {
      if (!this._instanceKeys.has(value.className))
        this._instanceKeys.set(value.className, new Set());
      this._instanceKeys.get(value.className)!.add(value.id);
    } else if (this.isNodeKey(value)) {
      this._nodeKeys.add(JSON.stringify(value));
    } else {
      throw new PresentationError(PresentationStatus.InvalidArgument, `Invalid argument: value = ${value}`);
    }
    if (this.size !== sizeBefore)
      this._guid = Guid.createValue();
    return this;
  }

  private deleteKeySet(keyset: Readonly<KeySet>): void {
    for (const key of (keyset as any)._nodeKeys)
      this._nodeKeys.delete(key);
    for (const entry of (keyset as any)._instanceKeys) {
      const set = this._instanceKeys.get(entry["0"]);
      if (set) {
        entry["1"].forEach((key: string) => {
          set.delete(key);
        });
      }
    }
  }

  private deleteKeySetJSON(keyset: Readonly<KeySetJSON>): void {
    for (const key of keyset.nodeKeys)
      this._nodeKeys.delete(JSON.stringify(key));
    for (const entry of keyset.instanceKeys) {
      const set = this._instanceKeys.get(entry["0"]);
      if (set) {
        entry["1"].forEach((key: string) => {
          set.delete(key);
        });
      }
    }
  }

  /**
   * Deletes a key or keys from this KeySet.
   * @param value A key or keys to delete.
   * @returns itself
   */
  public delete(value: Keys | Key): KeySet {
    if (!value)
      throw new PresentationError(PresentationStatus.InvalidArgument, `Invalid argument: value = ${value}`);
    const sizeBefore = this.size;
    if (this.isKeySet(value)) {
      this.deleteKeySet(value);
    } else if (this.isKeySetJSON(value)) {
      this.deleteKeySetJSON(value);
    } else if (this.isKeysArray(value)) {
      for (const key of value)
        this.delete(key);
    } else if (this.isEntityProps(value)) {
      this.delete({ className: value.classFullName, id: value.id! } as InstanceKey);
    } else if (this.isInstanceKey(value)) {
      const set = this._instanceKeys.get(value.className);
      if (set)
        set.delete(value.id);
    } else if (this.isNodeKey(value)) {
      this._nodeKeys.delete(JSON.stringify(value));
    } else {
      throw new PresentationError(PresentationStatus.InvalidArgument, `Invalid argument: value = ${value}`);
    }
    if (this.size !== sizeBefore)
      this._guid = Guid.createValue();
    return this;
  }

  /**
   * Check if this KeySet contains the specified key.
   * @param value The key to check.
   */
  public has(value: Key): boolean {
    if (!value)
      throw new PresentationError(PresentationStatus.InvalidArgument, `Invalid argument: value = ${value}`);
    if (this.isEntityProps(value))
      return this.has({ className: value.classFullName, id: value.id! } as InstanceKey);
    if (this.isInstanceKey(value)) {
      const set = this._instanceKeys.get(value.className);
      return !!(set && set.has(value.id));
    }
    if (this.isNodeKey(value))
      return this._nodeKeys.has(JSON.stringify(value));
    throw new PresentationError(PresentationStatus.InvalidArgument, `Invalid argument: value = ${value}`);
  }

  private hasKeySet(readonlyKeys: Readonly<KeySet>, checkType: "all" | "any"): boolean {
    // note: cast-away read-onlyness to access private members...
    const keys = readonlyKeys as KeySet;

    if (checkType === "all") {
      if (this._nodeKeys.size < keys._nodeKeys.size || this._instanceKeys.size < keys._instanceKeys.size)
        return false;
      if ([...keys._nodeKeys].some((key) => !this._nodeKeys.has(key)))
        return false;
      for (const otherEntry of keys._instanceKeys) {
        const thisEntryKeys = this._instanceKeys.get(otherEntry["0"]);
        if (!thisEntryKeys || thisEntryKeys.size < otherEntry["1"].size)
          return false;
        if ([...otherEntry["1"]].some((key) => !thisEntryKeys.has(key)))
          return false;
      }
      return true;
    }

    // "any" check type
    if ([...keys._nodeKeys].some((key) => this._nodeKeys.has(key)))
      return true;
    for (const otherEntry of keys._instanceKeys) {
      const thisEntryKeys = this._instanceKeys.get(otherEntry["0"]);
      if (thisEntryKeys && [...otherEntry["1"]].some((key) => thisEntryKeys.has(key)))
        return true;
    }
    return false;
  }

  private hasKeySetJSON(keys: Readonly<KeySetJSON>, checkType: "all" | "any"): boolean {
    if (checkType === "all") {
      if (this._nodeKeys.size < keys.nodeKeys.length || this._instanceKeys.size < keys.instanceKeys.length)
        return false;
      if ([...keys.nodeKeys].some((key) => !this._nodeKeys.has(JSON.stringify(key))))
        return false;
      for (const otherEntry of keys.instanceKeys) {
        const thisEntryKeys = this._instanceKeys.get(otherEntry["0"]);
        if (!thisEntryKeys || thisEntryKeys.size < otherEntry["1"].length)
          return false;
        if ([...otherEntry["1"]].some((key) => !thisEntryKeys.has(key)))
          return false;
      }
      return true;
    }

    // "any" check type
    if ([...keys.nodeKeys].some((key) => this._nodeKeys.has(JSON.stringify(key))))
      return true;
    for (const otherEntry of keys.instanceKeys) {
      const thisEntryKeys = this._instanceKeys.get(otherEntry["0"]);
      if (thisEntryKeys && [...otherEntry["1"]].some((key) => thisEntryKeys.has(key)))
        return true;
    }
    return false;
  }

  private hasKeysArray(keys: ReadonlyArray<Key>, checkType: "all" | "any"): boolean {
    if (checkType === "all") {
      if (this.size < keys.length)
        return false;
      for (const key of keys) {
        if (!this.has(key))
          return false;
      }
      return true;
    }

    // "any" check type
    for (const key of keys) {
      if (this.has(key))
        return true;
    }
    return false;
  }

  /**
   * Check if this KeySet contains all the specified keys.
   * @param keys The keys to check.
   */
  public hasAll(keys: Keys): boolean {
    if (!keys)
      throw new PresentationError(PresentationStatus.InvalidArgument, `Invalid argument: value = ${keys}`);
    if (this.isKeySet(keys))
      return this.hasKeySet(keys, "all");
    if (this.isKeySetJSON(keys))
      return this.hasKeySetJSON(keys, "all");
    if (this.isKeysArray(keys))
      return this.hasKeysArray(keys, "all");
    throw new PresentationError(PresentationStatus.InvalidArgument, `Invalid argument: keys = ${keys}`);
  }

  /**
   * Check if this KeySet contains any of the specified keys.
   * @param keys The keys to check.
   */
  public hasAny(keys: Keys): boolean {
    if (!keys)
      throw new PresentationError(PresentationStatus.InvalidArgument, `Invalid argument: value = ${keys}`);
    if (this.isKeySet(keys))
      return this.hasKeySet(keys, "any");
    if (this.isKeySetJSON(keys))
      return this.hasKeySetJSON(keys, "any");
    if (this.isKeysArray(keys))
      return this.hasKeysArray(keys, "any");
    throw new PresentationError(PresentationStatus.InvalidArgument, `Invalid argument: keys = ${keys}`);
  }

  /**
   * Get the number of keys stored in this KeySet.
   */
  public get size(): number {
    const nodeKeysCount = this._nodeKeys.size;
    let instanceIdsCount = 0;
    for (const set of this._instanceKeys.values())
      instanceIdsCount += set.size;
    return nodeKeysCount + instanceIdsCount;
  }

  /**
   * Is this KeySet currently empty.
   */
  public get isEmpty(): boolean {
    return 0 === this.size;
  }
}
