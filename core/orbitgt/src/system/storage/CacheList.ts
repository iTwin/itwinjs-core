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

import { AList } from "../collection/AList";
import { ASystem } from "../runtime/ASystem";
import { Strings } from "../runtime/Strings";
import { CachedItem } from "./CachedItem";

/**
 * Class CacheList caches a list of items based on last-recently-used order.
 */
/** @internal */
export class CacheList<T> {
  /** The optional maximum number of entries in the list (no maximum if zero) */
  private _maxEntries: int32;
  /** The list of entries (most used at the back) */
  private _entries: AList<CachedItem<T>>;
  /** The number of times a requested item was found in the cache */
  public hitCount: int32;
  /** The number of times a requested item was not found in the cache */
  public missCount: int32;

  /**
   * Create a new cache, with an optional non-zero maximum number of entries.
   */
  public constructor(maxEntries: int32) {
    this._maxEntries = maxEntries;
    this._entries = new AList<CachedItem<T>>();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get the number of entries in the cache.
   */
  public size(): int32 {
    return this._entries.size();
  }

  /**
   * Clear all entries.
   */
  public clear(): void {
    this._entries.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Find an entry in the cache, or return null if not found.
   */
  public findEntry(key: string): T {
    /* Check all entries */
    for (let i: number = 0; i < this._entries.size(); i++) {
      /* Search back (most used) to front (least used) */
      let entryIndex: int32 = this._entries.size() - 1 - i;
      /* Is this the requested entry? */
      let entry: CachedItem<T> = this._entries.get(entryIndex);
      if (Strings.equals(entry.key, key)) {
        /* Move the latest-used entry to the back of the list */
        if (entryIndex < this._entries.size() - 1) {
          this._entries.remove(entryIndex);
          this._entries.add(entry);
        }
        /* Update the access time */
        entry.accessTime = ASystem.time();
        /* The entry was found */
        this.hitCount++;
        return entry.element;
      }
    }
    /* No entry was found */
    this.missCount++;
    return null;
  }

  /**
   * Add an entry to the cache, pushing out the oldest entry if the cache is full.
   */
  public addEntry(key: string, element: T): void {
    /* Add a new entry to the back of the list */
    this._entries.add(new CachedItem<T>(key, element, ASystem.time()));
    if (this._maxEntries > 0 && this._entries.size() > this._maxEntries)
      this._entries.remove(0);
  }
}
