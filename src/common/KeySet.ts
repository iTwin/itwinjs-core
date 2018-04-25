/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as assert from "assert";
import { Id64 } from "@bentley/bentleyjs-core";
import { InstanceId, InstanceKey } from "./EC";
import { NodeKey } from "./Hierarchy";
import { EntityProps } from "@bentley/imodeljs-common";

export type Key = Readonly<NodeKey> | Readonly<InstanceKey> | Readonly<EntityProps>;
export type Keys = ReadonlyArray<Key> | Readonly<SerializedKeySet> | Readonly<KeySet>;

export interface SerializedKeySet {
  instanceKeys: Array<[string, string[]]>;
  nodeKeys: NodeKey[];
}

export default class KeySet {
  // note: all keys are stored as strings because we need ability to find them by value
  private _instanceKeys: Map<string, Set<string>>; // class name => instance ids
  private _nodeKeys: Set<string>;

  constructor(source?: Keys) {
    this._instanceKeys = new Map();
    this._nodeKeys = new Set();
    if (source)
      this.add(source);
  }

  public toJSON(): SerializedKeySet {
    const instanceKeys = new Array();
    for (const entry of this._instanceKeys.entries())
      instanceKeys.push([entry["0"], [...entry["1"]]]);
    return {
      instanceKeys,
      nodeKeys: [...this.nodeKeys],
    };
  }

  public get instanceKeys(): ReadonlyMap<string, ReadonlySet<InstanceId>> {
    const map = new Map<string, Set<InstanceId>>();
    for (const entry of this._instanceKeys)
      map.set(entry["0"], new Set([...entry["1"]].map((key: string) => new Id64(key))));
    return map;
  }

  public get nodeKeys(): ReadonlySet<NodeKey> {
    const set = new Set<NodeKey>();
    for (const serialized of this._nodeKeys) {
      const key = JSON.parse(serialized, (objectKey: string, value: any): any => {
        if (typeof(objectKey) === "string" && objectKey.endsWith("Id"))
          return new Id64(value);
        return value;
      }) as NodeKey;
      set.add(key);
    }
    return set;
  }

  private isSerializedKeySet(set: Keys | Key): set is Readonly<SerializedKeySet> {
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

  public clear(): KeySet {
    this._instanceKeys = new Map();
    this._nodeKeys = new Set();
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

  private addSerializedKeySet(keyset: Readonly<SerializedKeySet>): void {
    for (const key of keyset.nodeKeys)
      this._nodeKeys.add(JSON.stringify(key));
    for (const entry of keyset.instanceKeys)
      this._instanceKeys.set(entry["0"], new Set(entry["1"]));
  }

  public add(value: Keys | Key): KeySet {
    if (!value)
      return this;
    if (this.isKeySet(value)) {
      this.addKeySet(value);
    } else if (this.isSerializedKeySet(value)) {
      this.addSerializedKeySet(value);
    } else if (this.isKeysArray(value)) {
      for (const key of value)
        this.add(key);
    } else if (this.isNodeKey(value)) {
      this._nodeKeys.add(JSON.stringify(value));
    } else if (this.isInstanceKey(value)) {
      if (!this._instanceKeys.has(value.className))
        this._instanceKeys.set(value.className, new Set());
      this._instanceKeys.get(value.className)!.add(value.id.value);
    } else if (this.isEntityProps(value)) {
      this.add({ className: value.classFullName, id: new Id64(value.id) } as InstanceKey);
    } else {
      assert(false);
    }
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

  private deleteSerializedKeySet(keyset: Readonly<SerializedKeySet>): void {
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

  public delete(value: Keys | Key): KeySet {
    if (!value)
      return this;
    if (this.isKeySet(value)) {
      this.deleteKeySet(value);
    } else if (this.isSerializedKeySet(value)) {
      this.deleteSerializedKeySet(value);
    } else if (this.isKeysArray(value)) {
      for (const key of value)
        this.delete(key);
    } else if (this.isNodeKey(value)) {
      this._nodeKeys.delete(JSON.stringify(value));
    } else if (this.isInstanceKey(value)) {
      const set = this._instanceKeys.get(value.className);
      if (set)
        set.delete(value.id.value);
    } else if (this.isEntityProps(value)) {
      this.delete({ className: value.classFullName, id: value.id! } as InstanceKey);
    } else {
      assert(false);
    }
    return this;
  }

  public has(value: Key): boolean {
    if (!value)
      return false;
    if (this.isNodeKey(value))
      return this._nodeKeys.has(JSON.stringify(value));
    if (this.isInstanceKey(value)) {
      const set = this._instanceKeys.get(value.className);
      return !!(set && set.has(value.id.value));
    }
    if (this.isEntityProps(value))
      return this.has({ className: value.classFullName, id: value.id! } as InstanceKey);
    assert(false);
    return false;
  }

  public get size(): number {
    const nodeKeysCount = this._nodeKeys.size;
    let instanceIdsCount = 0;
    for (const set of this._instanceKeys.values())
      instanceIdsCount += set.size;
    return nodeKeysCount + instanceIdsCount;
  }

  public get isEmpty(): boolean {
    return 0 === this.size;
  }
}
