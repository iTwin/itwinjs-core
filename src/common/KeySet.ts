/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as assert from "assert";
import { Id64 } from "@bentley/bentleyjs-core";
import { InstanceId, InstanceKey } from "./EC";
import { NavNodeKey } from "./Hierarchy";
import { EntityProps } from "@bentley/imodeljs-common";

export type Key = NavNodeKey | InstanceKey | EntityProps;
export type Keys = NavNodeKey[] | InstanceKey[] | EntityProps[];

export interface SerializedKeySet {
  instanceKeys: Array<[string, string[]]>;
  nodeKeys: NavNodeKey[];
}

export default class KeySet {
  // note: all keys are stored as strings because we need ability to find them by value
  private _instanceKeys: Map<string, Set<string>>; // class name => instance ids
  private _nodeKeys: Set<string>;

  constructor(source?: Keys | SerializedKeySet) {
    this._instanceKeys = new Map();
    this._nodeKeys = new Set();
    if (source)
      this.initFromSource(source);
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

  private initFromSource(source: Keys | SerializedKeySet) {
    this.clear();
    if (Array.isArray(source)) {
      this.add(source);
    } else {
      for (const key of source.nodeKeys)
        this._nodeKeys.add(JSON.stringify(key));
      for (const entry of source.instanceKeys)
        this._instanceKeys.set(entry["0"], new Set(entry["1"]));
    }
  }

  public get instanceKeys(): ReadonlyMap<string, ReadonlySet<InstanceId>> {
    const map = new Map<string, Set<InstanceId>>();
    for (const entry of this._instanceKeys)
      map.set(entry["0"], new Set([...entry["1"]].map((key: string) => new Id64(key))));
    return map;
  }

  public get nodeKeys(): ReadonlySet<NavNodeKey> {
    const set = new Set<NavNodeKey>();
    for (const serialized of this._nodeKeys) {
      const key = JSON.parse(serialized, (objectKey: string, value: any): any => {
        if (typeof(objectKey) === "string" && objectKey.endsWith("Id"))
          return new Id64(value);
        return value;
      }) as NavNodeKey;
      set.add(key);
    }
    return set;
  }

  private isNodeKey(key: Key): key is NavNodeKey {
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

  public add(value: Keys | Key): KeySet {
    if (!value)
      return this;
    if (Array.isArray(value)) {
      for (const key of value)
        this.add(key);
    } else if (this.isNodeKey(value)) {
      this._nodeKeys.add(JSON.stringify(value));
    } else if (this.isInstanceKey(value)) {
      if (!this._instanceKeys.has(value.className))
        this._instanceKeys.set(value.className, new Set());
      this._instanceKeys.get(value.className)!.add(value.id.value);
    } else if (this.isEntityProps(value)) {
      this.add({ className: value.classFullName, id: value.id! } as InstanceKey);
    } else {
      assert(false);
    }
    return this;
  }

  public delete(value: Keys | Key): KeySet {
    if (!value)
      return this;
    if (Array.isArray(value)) {
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
      return (set && set.has(value.id.value)) as boolean;
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
}
