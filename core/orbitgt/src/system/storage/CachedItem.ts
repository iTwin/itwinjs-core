/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.system.storage;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

/**
 * Class CachedItem stores a single entry in a cache of items.
 */
/** @internal */
export class CachedItem<T> {
  /** The unique key of the item */
  public key: string;
  /** The item to cache */
  public element: T;
  /** The latest access time of the item */
  public accessTime: float64;

  /**
   * Create a new item.
   */
  public constructor(key: string, element: T, accessTime: float64) {
    this.key = key;
    this.element = element;
    this.accessTime = accessTime;
  }
}
