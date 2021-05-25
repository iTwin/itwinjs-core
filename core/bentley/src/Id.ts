/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Ids
 */

/** A string containing a well-formed string representation of an [Id64]($bentleyjs-core).
 * See [Working with Ids]($docs/learning/common/Id64.md).
 * @public
 */
export type Id64String = string;

/** A string containing a well-formed string representation of a [Guid]($bentleyjs-core).
 * @public
 */
export type GuidString = string;

/** A set of [[Id64String]]s.
 * @public
 */
export type Id64Set = Set<Id64String>;

/** An array of [[Id64String]]s.
 * @public
 */
export type Id64Array = Id64String[];

/** Used as an argument to a function that can accept one or more [[Id64String]]s.
 * @public
 */
export type Id64Arg = Id64String | Id64Set | Id64Array;

function toHex(str: string): number {
  const v = parseInt(str, 16);
  return Number.isNaN(v) ? 0 : v;
}

function isLowerCaseNonZeroHexDigit(str: string, index: number) {
  return isLowerCaseHexDigit(str, index, false);
}

function isLowerCaseHexDigit(str: string, index: number, allowZero: boolean = true): boolean {
  const charCode = str.charCodeAt(index);
  const minDecimalDigit = allowZero ? 0x30 : 0x31; // '0' or '1'...
  return (charCode >= minDecimalDigit && charCode <= 0x39) || (charCode >= 0x61 && charCode <= 0x66); //  '0'-'9, 'a' -'f'
}

function isValidHexString(id: string, startIndex: number, len: number) {
  if (len === 0)
    return false;

  // No leading zeroes...
  if (!isLowerCaseNonZeroHexDigit(id, startIndex))
    return false;

  // ...followed by len-1 lowercase hexadecimal digits.
  for (let i = 1; i < len; i++)
    if (!isLowerCaseHexDigit(id, startIndex + i))
      return false;

  return true;
}

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

    const len = id.length;
    const start = (len > 12) ? (len - 10) : 2;
    return toHex(id.slice(start));
  }

  /** Extract the briefcase Id portion of an Id64String, contained in the upper 24 bits of the 64-bit value. */
  export function getBriefcaseId(id: Id64String): number {
    if (isInvalid(id))
      return 0;

    const len = id.length;
    return (len <= 12) ? 0 : toHex(id.slice(2, len - 10));
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
   * Otherwise, the input is trimmed of leading and trailing whitespace, converted to lowercase, and an attempt is made to parse it as a 64-bit hexadecimal integer.
   * If parsing succeeds the normalized result is returned; otherwise the result is "0", indicating an invalid Id.
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

    // Attempt to normalize the input into a well-formed Id string
    val = val.toLowerCase().trim();
    const len = val.length;
    if (len < 2 || val[0] !== "0" || val[1] !== "x")
      return invalid;

    let low = 0;
    let high = 0;
    let start = 2;
    if (len > 12) {
      start = (len - 10);
      high = toHex(val.slice(2, start));
    }

    low = toHex(val.slice(start));
    return fromLocalAndBriefcaseIds(low, high);
  }

  // Used when constructing local ID portion of Id64String. Performance optimization.
  const _localIdPrefixByLocalIdLength = [ // eslint-disable-line @typescript-eslint/naming-convention
    "0000000000",
    "000000000",
    "00000000",
    "0000000",
    "000000",
    "00000",
    "0000",
    "000",
    "00",
    "0",
    "",
  ];

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

    localId = Math.floor(localId);
    if (0 === localId)
      return invalid;

    briefcaseId = Math.floor(briefcaseId);
    const lowStr = localId.toString(16);
    return `0x${(briefcaseId === 0) ? lowStr : (briefcaseId.toString(16) + (_localIdPrefixByLocalIdLength[lowStr.length] + lowStr))}`;
  }

  // Used as a buffer when converting a pair of 32-bit integers to an Id64String. Significant performance optimization.
  const scratchCharCodes = [
    0x30, // "0"
    0x78, // "x"
    0x30, // "0"
    0x30,
    0x30,
    0x30,
    0x30,
    0x30,
    0x30,
    0x30,
    0x30,
    0x30,
    0x30,
    0x30,
    0x30,
    0x30,
    0x30,
    0x30,
  ];

  // Convert 4-bit unsigned integer to char code representing lower-case hexadecimal digit.
  function uint4ToCharCode(uint4: number): number {
    return uint4 + (uint4 < 10 ? 0x30 : 0x57);
  }

  // Convert char code representing lower-case hexadecimal digit to 4-bit unsigned integer.
  function charCodeToUint4(char: number): number {
    return char - (char >= 0x57 ? 0x57 : 0x30);
  }

  // Convert a substring to a uint32. This is twice as fast as using Number.parseInt().
  function substringToUint32(id: Id64String, start: number, end: number): number {
    let uint32 = 0;
    for (let i = start; i < end; i++) {
      const uint4 = charCodeToUint4(id.charCodeAt(i));
      const shift = (end - i - 1) << 2;
      const mask = uint4 << shift;
      uint32 = (uint32 | mask) >>> 0; // >>> 0 to force unsigned because javascript
    }

    return uint32;
  }

  /** Create an Id64String from a pair of unsigned 32-bit integers.
   * @param lowBytes The lower 4 bytes of the Id
   * @param highBytes The upper 4 bytes of the Id
   * @returns an Id64String containing the hexadecimal string representation of the unsigned 64-bit integer which would result from the
   * operation `lowBytes | (highBytes << 32)`.
   * @see [[Id64.fromUint32PairObject]] if you have a [[Id64.Uint32Pair]] object.
   */
  export function fromUint32Pair(lowBytes: number, highBytes: number): Id64String {
    const localIdLow = lowBytes >>> 0;
    const localIdHigh = (highBytes & 0x000000ff) * (0xffffffff + 1); // aka (highBytes & 0xff) << 32
    const localId = localIdLow + localIdHigh; // aka localIdLow | localIdHigh
    if (0 === localId)
      return invalid;

    // Need to omit or preserve leading zeroes...
    const buffer = scratchCharCodes;
    let index = 2;
    for (let i = 7; i >= 0; i--) {
      const shift = i << 2;
      const mask = 0xf << shift;
      const uint4 = (highBytes & mask) >>> shift;
      if (index > 2 || 0 !== uint4)
        buffer[index++] = uint4ToCharCode(uint4);
    }

    for (let i = 7; i >= 0; i--) {
      const shift = i << 2;
      const mask = 0xf << shift;
      const uint4 = (lowBytes & mask) >>> shift;
      if (index > 2 || 0 !== uint4)
        buffer[index++] = uint4ToCharCode(uint4);
    }

    if (buffer.length !== index)
      buffer.length = index;

    return String.fromCharCode(...scratchCharCodes);
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

    const end = id.length;
    const start = end > 10 ? end - 8 : 2;
    return substringToUint32(id, start, end);
  }

  /** Extract an unsigned 32-bit integer from the upper 4 bytes of an Id64String. */
  export function getUpperUint32(id: Id64String): number {
    const len = id.length;
    if (len <= 10 || isInvalid(id))
      return 0;

    return substringToUint32(id, 2, len - 8);
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
  export function * iterator(ids: Id64Arg): Iterator<Id64String> {
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

  /** Execute a function on each [[Id64String]] of an [[Id64Arg]].
   * @param arg The Id(s) to iterate.
   * @param callback The function to invoke on each Id.
   * @deprecated use [[Id64.iterable]].
   */
  export function forEach(arg: Id64Arg, callback: (id: Id64String) => void): void {
    for (const id of Id64.iterable(arg))
      callback(id);
  }

  /** Execute a function on each [[Id64String]] of an [[Id64Arg]], optionally terminating before iteration completes.
   * @param arg The Id(s) to iterate.
   * @param callback The function to invoke on each Id. The function returns false to terminate iteration, or true to continue iteration.
   * @returns True if all Ids were iterated, or false if iteration was terminated due to the callback returning false.
   * @deprecated use [[Id64.iterable]].
   */
  export function iterate(arg: Id64Arg, callback: (id: Id64String) => boolean): boolean {
    for (const id of Id64.iterable(arg))
      if (!callback(id))
        return false;

    return true;
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

  /** The string representation of an invalid Id. */
  export const invalid = "0";

  /** Determine if the supplied id string represents a transient Id.
   * @param id A well-formed Id string.
   * @returns true if the Id represents a transient Id.
   * @note This method assumes the input is a well-formed Id string.
   * @see [[Id64.isTransientId64]]
   * @see [[TransientIdSequence]]
   */
  export function isTransient(id: Id64String): boolean {
    // A transient Id is of the format "0xffffffxxxxxxxxxx" where the leading 6 digits indicate an invalid briefcase Id.
    return 18 === id.length && id.startsWith("0xffffff");
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
    const len = id.length;
    if (0 === len || 18 < len)
      return false;

    if ("0" !== id[0])
      return false;

    // Well-formed invalid Id: "0"
    if (1 === len)
      return true;

    // Valid Ids begin with "0x" followed by at least one lower-case hexadecimal digit.
    if (2 === len || "x" !== id[1])
      return false;

    // If briefcase Id is present, it occupies at least one digit, followed by 10 digits for local Id
    let localIdStart = 2;
    if (len > 12) {
      localIdStart = len - 10;

      // Verify briefcase Id
      if (!isValidHexString(id, 2, localIdStart - 2))
        return false;

      // Skip leading zeroes in local Id
      for (let i = localIdStart; i < len; i++) {
        if (0x30 !== id.charCodeAt(i)) // '0'
          break;
        else
          localIdStart++;
      }

      if (localIdStart >= len)
        return false;
    }

    return isValidHexString(id, localIdStart, len - localIdStart);
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

/**
 * Generates unique [[Id64String]] values in sequence, which are guaranteed not to conflict with Ids associated with persistent elements or models.
 * This is useful for associating stable, non-persistent identifiers with things like [Decorator]($frontend)s.
 * A TransientIdSequence can generate a maximum of (2^40)-2 unique Ids.
 * @public
 */
export class TransientIdSequence {
  private _localId: number = 0;

  /** Generate and return the next transient Id64String in the sequence. */
  public get next(): Id64String { return Id64.fromLocalAndBriefcaseIds(++this._localId, 0xffffff); }
}

/**
 * The Guid namespace provides facilities for working with GUID strings using the "8-4-4-4-12" pattern.
 *
 * The [[GuidString]] type alias is used to indicate function arguments, return types, and variables which are known to
 * be in the GUID format.
 * @public
 */
export namespace Guid {
  const uuidPattern = new RegExp("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

  /** Represents the empty Guid 00000000-0000-0000-0000-000000000000 */
  export const empty: GuidString = "00000000-0000-0000-0000-000000000000";

  /** Determine whether the input string is "guid-like". That is, it follows the 8-4-4-4-12 pattern. This does not enforce
   *  that the string is actually in valid UUID format.
   */
  export function isGuid(value: string): boolean { return uuidPattern.test(value); }

  /** Determine whether the input string is a valid V4 Guid string */
  export function isV4Guid(value: string): boolean { return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value); }

  /** Create a new V4 Guid value */
  export function createValue(): GuidString {
    // https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Normalize a Guid string if possible. Normalization consists of:
   * - Convert all characters to lower case
   * - Trim any leading or trailing whitespace
   * - Convert to the standard Guid format "8-4-4-4-12", repositioning the '-' characters as necessary, presuming there are exactly 32 hexadecimal digits.
   * @param value Input value that represents a Guid
   * @returns Normalized representation of the Guid string. If the normalization fails, return the *original* value unmodified (Note: it is *not* a valid Guid)
   */
  export function normalize(value: GuidString): GuidString {
    const lowerValue = value.toLowerCase().trim();

    // Return if it's already formatted to be a Guid
    if (isGuid(lowerValue))
      return lowerValue;

    // Remove any existing "-" characters and position them properly, if there remains exactly 32 hexadecimal digits
    const noDashValue = lowerValue.replace(/-/g, "");
    const noDashPattern = /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/;
    if (noDashPattern.test(noDashValue)) {
      return noDashValue.replace(noDashPattern,
        (_match: string, p1: string, p2: string, p3: string, p4: string, p5: string) =>
          `${p1}-${p2}-${p3}-${p4}-${p5}`);
    }

    // Return unmodified string - (note: it is *not* a valid Guid)
    return value;
  }
}
