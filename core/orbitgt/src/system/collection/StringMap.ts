/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { AList } from "./AList";

/**
 * Class StringMap defines a map of elements in which the keys are strings.
 */
/** @internal */
export class StringMap<V> {
  private _map: Map<string, V>;

  public constructor() {
    this._map = new Map<string, V>();
  }

  public size(): int32 {
    return this._map.size;
  }

  public contains(key: string): boolean {
    return this._map.has(key);
  }

  public containsKey(key: string): boolean {
    return this._map.has(key);
  }

  public get(key: string): V {
    return this._map.get(key);
  }

  public set(key: string, value: V): void {
    this._map.set(key, value);
  }

  public put(key: string, value: V): void {
    this._map.set(key, value);
  }

  public remove(key: string): void {
    this._map.delete(key);
  }

  public clear(): void {
    this._map.clear();
  }

  public keysArray(): Array<string> {
    return Array.from(this._map.keys());
  }

  public keys(): AList<string> {
    let keys: AList<string> = new AList<string>();
    for (let key of this._map.keys()) keys.add(key);
    return keys;
  }

  public valuesArray(): Array<V> {
    return Array.from(this._map.values());
  }

  public values(): AList<V> {
    let values: AList<V> = new AList<V>();
    for (let value of this._map.values()) values.add(value);
    return values;
  }
}
