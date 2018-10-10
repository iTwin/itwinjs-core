/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utils */

/*
 * Derived from:
 * Licensed under MIT. Copyright (c) 2010 Rasmus Andersson <http://hunch.se/>
 * See README.md at https://github.com/rsms/js-lru for details.
 */

/** An entry holds the key and value, and pointers to any older and newer entries. */
export class Entry<K, V> {
  public newer?: Entry<K, V>;
  public older?: Entry<K, V>;
  constructor(public key: K, public value: V) { }
}

class EntryIterator<K, V> implements Iterator<[K, V] | undefined> {
  private _entry: Entry<K, V> | undefined;
  constructor(oldestEntry: Entry<K, V>) {
    this._entry = oldestEntry;
  }
  public next() {
    const ent = this._entry;
    if (!ent)
      return { done: true, value: undefined };
    this._entry = ent.newer;
    const val: [K, V] = [ent.key, ent.value];
    return { done: false, value: val };
  }
}

class KeyIterator<K, V> implements Iterator<K | undefined>  {
  private _entry: Entry<K, V> | undefined;
  constructor(oldestEntry: Entry<K, V>) {
    this._entry = oldestEntry;
  }
  public next() {
    const ent = this._entry;
    if (!ent)
      return { done: true, value: undefined };
    this._entry = ent.newer;
    return { done: false, value: ent.key };
  }
}

class ValueIterator<K, V> implements Iterator<V | undefined> {
  private _entry: Entry<K, V> | undefined;
  constructor(oldestEntry: Entry<K, V>) {
    this._entry = oldestEntry;
  }
  public next() {
    const ent = this._entry;
    if (!ent)
      return { done: true, value: undefined };
    this._entry = ent.newer;
    return { done: false, value: ent.value };
  }
}

/**
 * A Map of a key/value pairs, where the size of the map can be limited.
 *
 * When entries are inserted, if the map is "full", the
 * least-recently-used (LRU) value is dropped. When entries are retrieved, they are moved to the front of the LRU list.
 *
 * Illustration of the design:
 *
 * ```
 *
 *       entry             entry             entry             entry
 *       ______            ______            ______            ______
 *      | head |.newer => |      |.newer => |      |.newer => | tail |
 *      |  A   |          |  B   |          |  C   |          |  D   |
 *      |______| <= older.|______| <= older.|______| <= older.|______|
 *
 *  removed  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  added
 * ```
 */
export class LRUMap<K, V> {
  private _keymap: Map<K, Entry<K, V>>;

  /** Current number of items */
  public size: number;

  /** Maximum number of items this map can hold */
  public limit: number;

  /** Least recently-used entry. Invalidated when map is modified. */
  public oldest?: Entry<K, V>;

  /** Most recently-used entry. Invalidated when map is modified. */
  public newest?: Entry<K, V>;

  /**
   * Construct a new LRUMap to hold up to limit entries.
   */
  constructor(limit: number) {
    this.size = 0;
    this.limit = limit;
    this.oldest = this.newest = undefined;
    this._keymap = new Map<K, Entry<K, V>>();
  }

  private markEntryAsUsed(entry: Entry<K, V>) {
    if (entry === this.newest)
      return; // Already the most recently used entry, so no need to update the list

    // HEAD--------------TAIL
    //   <.older   .newer>
    //  <--- add direction --
    //   A  B  C  <D>  E
    if (entry.newer) {
      if (entry === this.oldest) {
        this.oldest = entry.newer;
      }
      entry.newer.older = entry.older; // C <-- E.
    }
    if (entry.older) {
      entry.older.newer = entry.newer; // C. --> E
    }
    entry.newer = undefined; // D --x
    entry.older = this.newest; // D. --> E
    if (this.newest) {
      this.newest.newer = entry; // E. <-- D
    }
    this.newest = entry;
  }

  /**  Replace all values in this map with key-value pairs (2-element Arrays) from provided iterable. */
  public assign(entries: Iterable<[K, V]>): void {
    let entry;
    let limit = this.limit || Number.MAX_VALUE;
    this._keymap.clear();
    const it = entries[Symbol.iterator]();
    for (let itv = it.next(); !itv.done; itv = it.next()) {
      const e = new Entry(itv.value[0], itv.value[1]);
      this._keymap.set(e.key, e);
      if (!entry) {
        this.oldest = e;
      } else {
        entry.newer = e;
        e.older = entry;
      }
      entry = e;
      if (limit-- === 0) {
        throw new Error("overflow");
      }
    }
    this.newest = entry;
    this.size = this._keymap.size;
  }

  /** Get and register recent use of <key>.
   *  Returns the value associated with <key> or undefined if not in cache.
   */
  public get(key: K): V | undefined {
    // First, find our cache entry
    const entry = this._keymap.get(key);
    if (!entry)
      return; // Not cached. Sorry.
    // As <key> was found in the cache, register it as being requested recently
    this.markEntryAsUsed(entry);
    return entry.value;
  }

  /** Put <value> into the cache associated with <key>. Replaces any existing entry with the same key.
   *  @returns `this`.
   */
  public set(key: K, value: V): LRUMap<K, V> {
    let entry = this._keymap.get(key);
    if (entry) {
      // update existing
      entry.value = value;
      this.markEntryAsUsed(entry);
      return this;
    }

    // new entry
    this._keymap.set(key, (entry = new Entry(key, value)));

    if (this.newest) {
      // link previous tail to the new tail (entry)
      this.newest.newer = entry;
      entry.older = this.newest;
    } else {
      // we're first in
      this.oldest = entry;
    }

    // add new entry to the end of the linked list -- it is now the freshest entry.
    this.newest = entry;
    ++this.size;
    if (this.size > this.limit) {
      // we hit the limit -- remove the head
      this.shift();
    }
    return this;
  }

  /**  Purge the least recently used (oldest) entry from the cache.
   *  @returns The removed entry or undefined if the cache was empty.
   */
  public shift(): [K, V] | undefined {
    const entry = this.oldest;
    if (entry) {
      if (entry.newer) {
        // advance the list
        this.oldest = entry.newer;
        this.oldest.older = undefined;
      } else {
        // the cache is exhausted
        this.oldest = undefined;
        this.newest = undefined;
      }
      // Remove last strong reference to <entry> and remove links from the purged
      // entry being returned:
      entry.newer = entry.older = undefined;
      this._keymap.delete(entry.key);
      --this.size;
      return [entry.key, entry.value];
    }
    return undefined;
  }

  /** Access value for `key` without registering recent use. Useful if you do not
   *  want to change the state of the map, but only "peek" at it.
   *  @returns The value associated with `key` if found, or undefined if not found.
   */
  public find(key: K): V | undefined {
    const e = this._keymap.get(key);
    return e ? e.value : undefined;
  }

  /** Check if there's a value for key in the cache without registering recent use. */
  public has(key: K): boolean {
    return this._keymap.has(key);
  }

  /**  Remove entry `key` from cache and return its value.
   *  @returns The removed value, or undefined if not found.
   */
  public delete(key: K): V | undefined {
    const entry = this._keymap.get(key);
    if (!entry) return;
    this._keymap.delete(entry.key);
    if (entry.newer && entry.older) {
      // re-link the older entry with the newer entry
      entry.older.newer = entry.newer;
      entry.newer.older = entry.older;
    } else if (entry.newer) {
      // remove the link to us
      entry.newer.older = undefined;
      // link the newer entry to head
      this.oldest = entry.newer;
    } else if (entry.older) {
      // remove the link to us
      entry.older.newer = undefined;
      // link the newer entry to head
      this.newest = entry.older;
    } else { // if(entry.older === undefined && entry.newer === undefined) {
      this.oldest = this.newest = undefined;
    }

    this.size--;
    return entry.value;
  }

  /**  Removes all entries */
  public clear(): void {
    // Note: clearing links should be safe, as we don't expose live links to user
    this.oldest = this.newest = undefined;
    this.size = 0;
    this._keymap.clear();
  }

  /** Returns an iterator over all keys, starting with the oldest. */
  public keys(): Iterator<K | undefined> | undefined {
    return this.oldest ? new KeyIterator(this.oldest) : undefined;
  }

  /** Returns an iterator over all values, starting with the oldest. */
  public values(): Iterator<V | undefined> | undefined {
    return this.oldest ? new ValueIterator(this.oldest) : undefined;
  }

  /** Returns an iterator over all entries, starting with the oldest. */
  public entries(): Iterator<[K, V] | undefined> | undefined {
    return this.oldest ? new EntryIterator(this.oldest) : undefined;
  }

  /**  Call `fun` for each entry, starting with the oldest entry. */
  public forEach(fun: (value: V, key: K, m: LRUMap<K, V>) => void, thisObj?: any): void {
    if (typeof thisObj !== "object") {
      thisObj = this;
    }
    let entry = this.oldest;
    while (entry) {
      fun.call(thisObj, entry.value, entry.key, this);
      entry = entry.newer;
    }
  }

  /** Returns a JSON (array) representation */
  public toJSON(): Array<{ key: K, value: V }> {
    const s = new Array(this.size);
    let i = 0;
    let entry = this.oldest;
    while (entry) {
      s[i++] = { key: entry.key, value: entry.value };
      entry = entry.newer;
    }
    return s;
  }

  /** Returns a String representation */
  public toString(): string {
    let s = "";
    let entry = this.oldest;
    while (entry) {
      s += String(entry.key) + ":" + entry.value;
      entry = entry.newer;
      if (entry) {
        s += " < ";
      }
    }
    return s;
  }
}
