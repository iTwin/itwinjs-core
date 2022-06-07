/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Ids
 */

type Id64String = string;

type Id64Set = Set<Id64String>;

type Id64Array = Id64String[];

type Id64Arg = Id64String | Id64Set | Id64Array;

/**
 * The Id64 namespace provides facilities for working with 64-bit identifiers. These Ids are stored as 64-bit integers inside an [[IModelDb]], but must be represented
 * as strings in JavaScript because JavaScript does not intrinsically support 64-bit integers.
 *
 * The [[Id64String]] type alias is used to indicate function arguments, return types, and variables which are known to contain a well-formed representation of a 64-bit Id.
 *
 * See [Working with Ids]($docs/learning/common/Id64.md) for a detailed description and code examples.
 * @public
 */
export namespace Id64 {
  /** Extract the "local" Id portion of an Id64String, contained in the lower 40 bits of the 64-bit value. */
  export function getLocalId(id: Id64String): number {
    if (isInvalid(id))
      return 0;
    const _0 = id.charCodeAt(1);
    const _1 = id.charCodeAt(2);
    const _2 = id.charCodeAt(3);
    const _3 = id.charCodeAt(4);
    const _4 = id.charCodeAt(5);
    // javascript bitwise operators discard the high 32 bits so we need to use multiplication to SHIFT and addition to OR
    // and hope the interpreter will notice it's a power of two and optimize it into a native shift
    return ((_4 << 24) * 2**8) + (_3 << 24 | _2 << 16 | _1 << 8 | _0);
  }

  /** Extract the briefcase Id portion of an Id64String, contained in the upper 24 bits of the 64-bit value. */
  export function getBriefcaseId(id: Id64String): number {
    if (isInvalid(id))
      return 0;
    const _5 = id.charCodeAt(6);
    const _6 = id.charCodeAt(7);
    const _7 = id.charCodeAt(8);
    return _7 << 16 | _6 << 8 | _5;
  }

  /** Create an Id64String from its JSON representation.
   * @param prop The JSON representation of an Id.
   * @returns A well-formed Id string.
   * @note if the input is undefined, the result is "0", indicating an invalid Id.
   * @note if the input is not undefined, the result is the same as that of [[Id64.fromString]].
   */
  export function fromJSON(prop?: string): Id64String {
    return typeof prop === "string" ? Id64.fromString(prop) : Id64.invalid;
  }

  /** Given a string value, attempt to normalize it into a well-formed Id string.
   * If the input is already a well-formed Id string, it is returned unmodified.
   * Otherwise, the input is trimmed of leading and trailing whitespace, and an attempt is made to parse it as an L1ByteString of a serialized integer.
   * If parsing succeeds the result is returned; otherwise the result is the invalid id
   *
   * For a description of "well-formed", see [Working with Ids]($docs/learning/common/Id64.md).
   */
  export function fromString(val: string): Id64String {
    // NB: in case this is called from JavaScript, we must check the run-time type...
    if (typeof val !== "string")
      return invalid;

    // Skip the common case in which the input is already a well-formed Id string
    if (Id64.isId64(val))
      return val;
    else
      return Id64.invalid;
  }

  /** Produce an Id string from a local and briefcase Id.
   * @param localId The non-zero local Id as an unsigned 40-bit integer.
   * @param briefcaseId The briefcase Id as an unsigned 24-bit integer.
   * @returns an Id64String containing the hexadecimal string representation of the unsigned 64-bit integer which would result from the
   * operation `localId | (briefcaseId << 40)`, or an invalid Id "0" if the inputs are invalid.
   */
  export function fromLocalAndBriefcaseIds(localId: number, briefcaseId: number): Id64String {
    // NB: Yes, we must check the run-time type...
    if (typeof localId !== "number" || typeof briefcaseId !== "number")
      return invalid;

    const _0 = localId     >>>  0 & 0xff;
    const _1 = localId     >>>  8 & 0xff;
    const _2 = localId     >>> 16 & 0xff;
    const _3 = localId     >>> 24 & 0xff;
    // javascript bitwise operators discard the high 32 bits so we need to use multiplication to shift,
    // and hope the interpreter will notice it's a power of two and optimize it into a native shift
    const _4 = (localId / 2**8) >> 24 & 0xff;
    const _5 = briefcaseId >>>  0 & 0xff;
    const _6 = briefcaseId >>>  8 & 0xff;
    const _7 = briefcaseId >>> 16 & 0xff;

    // need to make sure node will never try to normalize latin encoded
    return `L${String.fromCharCode(_0, _1, _2, _3, _4, _5, _6, _7, 0)}`;
  }

  /** Create an Id64String from a pair of unsigned 32-bit integers.
   * @param lowBytes The lower 4 bytes of the Id
   * @param highBytes The upper 4 bytes of the Id
   * @returns an Id64String containing the little-endian latin1 encoding of the unsigned 64-bit integer which would result from the
   * operation `lowBytes | (highBytes << 32)`.
   * @see [[Id64.fromUint32PairObject]] if you have a [[Id64.Uint32Pair]] object.
   */
  export function fromUint32Pair(lowBytes: number, highBytes: number): Id64String {
    const _0 = lowBytes  >>>  0 & 0xff;
    const _1 = lowBytes  >>>  8 & 0xff;
    const _2 = lowBytes  >>> 16 & 0xff;
    const _3 = lowBytes  >>> 24 & 0xff;
    const _4 = highBytes >>>  0 & 0xff;
    const _5 = highBytes >>>  8 & 0xff;
    const _6 = highBytes >>> 16 & 0xff;
    const _7 = highBytes >>> 24 & 0xff;

    return `L${String.fromCharCode(_0, _1, _2, _3, _4, _5, _6, _7, 0)}`;
  }

  /** Create an Id64String from a [[Id64.Uint32Pair]].
   * @see [[Id64.fromUint32Pair]].
   */
  export function fromUint32PairObject(pair: Uint32Pair): Id64String {
    return fromUint32Pair(pair.lower, pair.upper);
  }

  /** Returns true if the inputs represent two halves of a valid 64-bit Id.
   * @see [[Id64.Uint32Pair]].
   */
  export function isValidUint32Pair(lowBytes: number, highBytes: number): boolean {
    // Detect local ID of zero
    return 0 !== lowBytes || 0 !== (highBytes & 0x000000ff);
  }

  /** Represents an unsigned 64-bit integer as a pair of unsigned 32-bit integers.
   * @see [[Id64.getUint32Pair]]
   * @see [[Id64.isValidUint32Pair]]
   */
  export interface Uint32Pair {
    /** The lower 4 bytes of the 64-bit integer. */
    lower: number;
    /** The upper 4 bytes of the 64-bit integer. */
    upper: number;
  }

  /** Convert an Id64String to a 64-bit unsigned integer represented as a pair of unsigned 32-bit integers.
   * @param id The well-formed string representation of a 64-bit Id.
   * @param out Used as the return value if supplied; otherwise a new object is returned.
   * @returns An object containing the parsed lower and upper 32-bit integers comprising the 64-bit Id.
   */
  export function getUint32Pair(id: Id64String, out?: Uint32Pair): Uint32Pair {
    if (!out)
      out = { lower: 0, upper: 0 };

    out.lower = getLowerUint32(id);
    out.upper = getUpperUint32(id);
    return out;
  }

  /** Extract an unsigned 32-bit integer from the lower 4 bytes of an Id64String. */
  export function getLowerUint32(id: Id64String): number {
    if (isInvalid(id))
      return 0;

    const _0 = id.charCodeAt(1);
    const _1 = id.charCodeAt(2);
    const _2 = id.charCodeAt(3);
    const _3 = id.charCodeAt(4);
    return _3 << 24 | _2 << 16 | _1 << 8 | _0;
  }

  /** Extract an unsigned 32-bit integer from the upper 4 bytes of an Id64String. */
  export function getUpperUint32(id: Id64String): number {
    if (!isId64(id))
      return 0;

    const _4 = id.charCodeAt(5);
    const _5 = id.charCodeAt(6);
    const _6 = id.charCodeAt(7);
    const _7 = id.charCodeAt(8);
    return _7 << 24 | _6 << 16 | _5 << 8 | _4;
  }

  /** Convert an [[Id64Arg]] into an [[Id64Set]].
   *
   * This method can be used by functions that accept an Id64Arg to conveniently process the value(s). For example:
   * ```ts
   *   public addCategories(arg: Id64Arg) { Id64.toIdSet(arg).forEach((id) => this.categories.add(id)); }
   * ```
   *
   * Alternatively, to avoid allocating a new Id64Set, use [[Id64.iterable]].
   *
   * @param arg The Ids to convert to an Id64Set.
   * @param makeCopy If true, and the input is already an Id64Set, returns a deep copy of the input.
   * @returns An Id64Set containing the set of [[Id64String]]s represented by the Id64Arg.
   */
  export function toIdSet(arg: Id64Arg, makeCopy: boolean = false): Id64Set {
    if (arg instanceof Set)
      return makeCopy ? new Set<string>(arg) : arg;

    const ids = new Set<Id64String>();
    if (typeof arg === "string")
      ids.add(arg);
    else if (Array.isArray(arg)) {
      arg.forEach((id: Id64String) => {
        if (typeof id === "string")
          ids.add(id);
      });
    }

    return ids;
  }

  /** Obtain iterator over the specified Ids.
   * @see [[Id64.iterable]].
   */
  export function* iterator(ids: Id64Arg): Iterator<Id64String> {
    if (typeof ids === "string") {
      yield ids;
    } else {
      for (const id of ids)
        yield id;
    }
  }

  /** Obtain an iterable over the specified Ids. Example usage:
   * ```ts
   *  const ids = ["0x123", "0xfed"];
   *  for (const id of Id64.iterable(ids))
   *    console.log(id);
   * ```
   */
  export function iterable(ids: Id64Arg): Iterable<Id64String> {
    return {
      [Symbol.iterator]: () => iterator(ids),
    };
  }

  /** Return the first [[Id64String]] of an [[Id64Arg]]. */
  export function getFirst(arg: Id64Arg): Id64String {
    return typeof arg === "string" ? arg : (Array.isArray(arg) ? arg[0] : arg.values().next().value);
  }

  /** Return the number of [[Id64String]]s represented by an [[Id64Arg]]. */
  export function sizeOf(arg: Id64Arg): number {
    return typeof arg === "string" ? 1 : (Array.isArray(arg) ? arg.length : arg.size);
  }

  /** Returns true if the [[Id64Arg]] contains the specified Id. */
  export function has(arg: Id64Arg, id: Id64String): boolean {
    if (typeof arg === "string")
      return arg === id;
    if (Array.isArray(arg))
      return -1 !== arg.indexOf(id);

    return arg.has(id);
  }

  /** The string representation of an invalid Id, an 'L' followed by 9 NUL characters (the little-endian integer 0 encoded at UTF-8) and then a NUL terminator */
  export const invalid = "L\0\0\0\0\0\0\0\0\0";

  /** Determine if the supplied id string represents a transient Id.
   * @param id A well-formed Id string.
   * @returns true if the Id represents a transient Id.
   * @note This method assumes the input is a well-formed Id string.
   * @see [[Id64.isTransientId64]]
   * @see [[TransientIdSequence]]
   */
  export function isTransient(id: Id64String): boolean {
    // A transient Id is of the format `L${localIdPortion}\xff\xff\xff\0` where '\xff\xff\xff' indicates an invalid briefcase Id.
    return id.charCodeAt(7) === 0xff && id.charCodeAt(6) === 0xff && id.charCodeAt(5) === 0xff;
  }

  /** Determine if the input is a well-formed [[Id64String]] and represents a transient Id.
   * @see [[Id64.isTransient]]
   * @see [[Id64.isId64]]
   * @see [[TransientIdSequence]]
   */
  export function isTransientId64(id: string): boolean {
    return isValidId64(id) && isTransient(id);
  }

  /** Determine if the input is a well-formed [[Id64String]].
   *
   * For a description of "well-formed", see [Working with Ids]($docs/learning/common/Id64.md).
   * @see [[Id64.isValidId64]]
   */
  export function isId64(id: string): boolean {
    // FIXME: make sure native code never returns any length but 10
    return id.length >= 10 && id[0] === "L";
  }

  /** Returns true if the input is not equal to the representation of an invalid Id.
   * @note This method assumes the input is a well-formed Id string.
   * @see [[Id64.isInvalid]]
   * @see [[Id64.isValidId64]]
   */
  export function isValid(id: Id64String): boolean { return Id64.invalid !== id; }

  /** Returns true if the input is a well-formed [[Id64String]] representing a valid Id.
   * @see [[Id64.isValid]]
   * @see [[Id64.isId64]]
   */
  export function isValidId64(id: string): boolean { return Id64.invalid !== id && Id64.isId64(id); }

  /** Returns true if the input is a well-formed [[Id64String]] representing an invalid Id.
   * @see [[Id64.isValid]]
   */
  export function isInvalid(id: Id64String): boolean { return Id64.invalid === id; }

  /** A specialized replacement for Set<Id64String> optimized for performance-critical code which represents large sets of 64-bit IDs as pairs of
   * 32-bit integers.
   * The internal representation is a Map<number, Set<number>> where the Map key is the upper 4 bytes of the IDs and the Set elements are the lower 4 bytes of the IDs.
   * Because the upper 4 bytes store the 24-bit briefcase ID plus the upper 8 bits of the local ID, there will be a very small distribution of unique Map keys.
   * To further optimize this data type, the following assumptions are made regarding the { lower, upper } inputs, and no validation is performed to confirm them:
   *  - The inputs are unsigned 32-bit integers;
   *  - The inputs represent a valid Id64String (e.g., local ID is not zero).
   * @see [[Id64.Uint32Map]] for a similarly-optimized replacement for Map<Id64String, T>
   * @public
   */
  export class Uint32Set {
    protected readonly _map = new Map<number, Set<number>>();

    /** Construct a new Uint32Set.
     * @param ids If supplied, all of the specified Ids will be added to the new set.
     */
    public constructor(ids?: Id64Arg) {
      if (undefined !== ids)
        this.addIds(ids);
    }

    /** Remove all contents of this set. */
    public clear(): void {
      this._map.clear();
    }

    /** Add an Id to the set. */
    public addId(id: Id64String): void {
      this.add(Id64.getLowerUint32(id), Id64.getUpperUint32(id));
    }

    /** Add any number of Ids to the set. */
    public addIds(ids: Id64Arg): void {
      for (const id of Id64.iterable(ids))
        this.addId(id);
    }

    /** Returns true if the set contains the specified Id. */
    public hasId(id: Id64String): boolean { return this.has(Id64.getLowerUint32(id), Id64.getUpperUint32(id)); }

    /** Add an Id to the set. */
    public add(low: number, high: number): void {
      let set = this._map.get(high);
      if (undefined === set) {
        set = new Set<number>();
        this._map.set(high, set);
      }

      set.add(low);
    }

    /** Remove an Id from the set. */
    public deleteId(id: Id64String): void {
      this.delete(Id64.getLowerUint32(id), Id64.getUpperUint32(id));
    }

    /** Remove any number of Ids from the set. */
    public deleteIds(ids: Id64Arg): void {
      for (const id of Id64.iterable(ids))
        this.deleteId(id);
    }

    /** Remove an Id from the set. */
    public delete(low: number, high: number): void {
      const set = this._map.get(high);
      if (undefined !== set)
        set.delete(low);
    }

    /** Returns true if the set contains the specified Id. */
    public has(low: number, high: number): boolean {
      const set = this._map.get(high);
      return undefined !== set && set.has(low);
    }

    /** Returns true if the set contains no Ids. */
    public get isEmpty(): boolean { return 0 === this._map.size; }

    /** Returns the number of Ids contained in the set. */
    public get size(): number {
      let size = 0;
      for (const entry of this._map)
        size += entry[1].size;

      return size;
    }

    /** Populates and returns an array of all Ids contained in the set. */
    public toId64Array(): Id64Array {
      const ids: Id64Array = [];
      for (const entry of this._map)
        for (const low of entry[1])
          ids.push(Id64.fromUint32Pair(low, entry[0]));

      return ids;
    }

    /** Populates and returns a set of all Ids contained in the set. */
    public toId64Set(): Id64Set {
      const ids = new Set<string>();
      for (const entry of this._map)
        for (const low of entry[1])
          ids.add(Id64.fromUint32Pair(low, entry[0]));

      return ids;
    }

    /** Execute a function against each Id in this set. */
    public forEach(func: (lo: number, hi: number) => void): void {
      for (const entry of this._map)
        for (const lo of entry[1])
          func(lo, entry[0]);
    }
  }

  /** A specialized replacement for Map<Id64String, T> optimized for performance-critical code.
   * @see [[Id64.Uint32Set]] for implementation details.
   * @public
   */
  export class Uint32Map<T> {
    protected readonly _map = new Map<number, Map<number, T>>();

    /** Remove all entries from the map. */
    public clear(): void { this._map.clear(); }
    /** Find an entry in the map by Id. */
    public getById(id: Id64String): T | undefined { return this.get(Id64.getLowerUint32(id), Id64.getUpperUint32(id)); }
    /** Set an entry in the map by Id. */
    public setById(id: Id64String, value: T): void { this.set(Id64.getLowerUint32(id), Id64.getUpperUint32(id), value); }

    /** Set an entry in the map by Id components. */
    public set(low: number, high: number, value: T): void {
      let map = this._map.get(high);
      if (undefined === map) {
        map = new Map<number, T>();
        this._map.set(high, map);
      }

      map.set(low, value);
    }

    /** Get an entry from the map by Id components. */
    public get(low: number, high: number): T | undefined {
      const map = this._map.get(high);
      return undefined !== map ? map.get(low) : undefined;
    }

    /** Returns true if the map contains no entries. */
    public get isEmpty(): boolean { return 0 === this._map.size; }
    /** Returns the number of entries in the map. */
    public get size(): number {
      let size = 0;
      for (const entry of this._map)
        size += entry[1].size;

      return size;
    }

    /** Execute a function against each entry in this map. */
    public forEach(func: (lo: number, hi: number, value: T) => void): void {
      for (const outerEntry of this._map)
        for (const innerEntry of outerEntry[1])
          func(innerEntry[0], outerEntry[0], innerEntry[1]);
    }
  }
}
