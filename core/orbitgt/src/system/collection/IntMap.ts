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

/**
 * Class IntMap defines a map of elements in which the keys are integer numbers.
 */
/** @internal */
export class IntMap<V> {
  private _map: Map<int32, V>;

  public constructor() {
    this._map = new Map<int32, V>();
  }

  public size(): int32 {
    return this._map.size;
  }

  public contains(key: int32): boolean {
    return this._map.has(key);
  }

  public get(key: int32): V {
    return this._map.get(key);
  }

  public set(key: int32, value: V): void {
    this._map.set(key, value);
  }

  public clear(): void {
    this._map.clear();
  }
}
