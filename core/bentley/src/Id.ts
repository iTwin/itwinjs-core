/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Ids */

/** The properties of a 64-bit Id value. When serialized, will always be a string. */
export type Id64Props = Id64 | string;

/** The properties of a GUID. When serialized, will always be a string. */
export type GuidProps = Guid | string;

/** A set of Id64 string values. Note that the set is **not** of Id64 objects, since JavaScript does not support non-primitive keys. */
export type Id64Set = Set<string>;

/** An array of Id64 string values. */
export type Id64Array = string[];

/** Used for arguments to functions that can accept one or more Id64 values. */
export type Id64Arg = Id64[] | Id64 | Id64Set | Id64Array | string;

/** An Id64 or its string representation. */
export type Id64String = Id64 | string;

/**
 * A 64 bit Id, stored as a hex string. This is necessary since JavaScript does not intrinsically support 64-bit integers.
 * @note If invalid, value will be "0".
 * @note Id64 is an immutable class. Its value cannot be changed.
 */
export class Id64 {
  public readonly value: string;
  private static toHex(str: string): number { const v = parseInt(str, 16); return Number.isNaN(v) ? 0 : v; }
  protected toJSON(): string { return this.value; }

  /** Get the "low" part of this Id64. This is the "local id", and is the lower 40 bits of the 64 bit value. */
  public getLow(): number { return Id64.getLow(this); }

  /** Get the "low" part of an Id64 string. This is the "local id", and is the lower 40 bits of the 64 bit value. */
  public static getLow(id: Id64String): number {
    if (this.isInvalidId(id))
      return 0;

    const str = id.toString();
    let start = 2;
    const len = str.length;
    if (len > 12)
      start = (len - 10);

    return this.toHex(str.slice(start));
  }

  /** Get the "high" part of this Id64. This is the "briefcase id", and is the high 24 bits of the 64 bit value. */
  public getHigh(): number { return Id64.getHigh(this); }

  /** Get the "high" part of an Id64 string. This is the "briefcase id", and is the high 24 bits of the 64 bit value. */
  public static getHigh(id: Id64String): number {
    if (this.isInvalidId(id))
      return 0;

    const str = id.toString();
    let start = 2;
    const len = str.length;
    if (len <= 12)
      return 0;

    start = (len - 10);
    return this.toHex(str.slice(2, start));
  }

  /**
   * Constructor for Id64
   * @param prop either a string with a hex number, another Id64, or an array of two numbers with [low,high]. Otherwise result will be invalid.
   * @note If valid, the value will be *normalized* to always be in the form "0x123abc". That is, it will
   * only have lowercase letters, with no leading zeros after the "0x"
   */
  constructor(prop?: Id64Props | number[]) {
    if (!prop) {
      this.value = "0";
      return;
    }

    let low = 0;
    let high = 0;

    if (typeof prop === "string") {
      prop = prop.toLowerCase().trim();
      if (prop[0] !== "0" || !(prop[1] === "x")) {
        this.value = "0";
        return;
      }

      let start = 2;
      const len = prop.length;
      if (len > 12) {
        start = (len - 10);
        high = Id64.toHex(prop.slice(2, start));
      }

      low = Id64.toHex(prop.slice(start));
    } else if (prop instanceof Id64) {
      this.value = prop.value;
      return;
    }

    if (Array.isArray(prop) && prop.length >= 2 && "number" === typeof prop[0] && "number" === typeof prop[1]) {
      low = Math.floor(prop[0]);
      high = Math.floor(prop[1]);
    }

    if (low === 0) { // it is illegal to have a low value of 0
      this.value = "0";
      return;
    }

    const lowStr = low.toString(16).toLowerCase();
    this.value = "0x" + ((high === 0) ? lowStr : (high.toString(16).toLowerCase() + ("0000000000" + lowStr).substr(-10)));
  }

  /** Convert this Id64 to a string */
  public toString(): string { return this.value; }

  /** Determine whether this Id64 is valid.
   * @note The value of an invalid Id64 is "0".
   */
  public get isValid(): boolean { return this.value !== "0"; }

  /** Test whether two Id64s are the same
   * @param other the other Id64 to compare
   */
  public equals(other: Id64): boolean { return this.value === other.value; }

  /** Compare two (potentially undefined) Id64 strings.
   * @param a The first value, may be undefined
   * @param b The second value, may be undefined
   */
  public static areEqual(a?: Id64String, b?: Id64String): boolean {
    if (undefined === a)
      return undefined === b;
    else if (undefined === b)
      return false;
    else
      return a.toString() === b.toString();
  }

  /** Create an Id64 from a json object. If val is already an Id64, just return it since Id64s are immutable.
   * @param val the json object containing Id64Props. If val does not contain valid values, result will be an invalid Id64.
   */
  public static fromJSON(val?: Id64Props): Id64 {
    if (undefined === val)
      return this.invalidId;
    else if (val instanceof Id64)
      return val;
    else
      return new Id64(val);
  }

  /** Create an Id64 from a pair of unsigned 32-bit integers.
   * @param lowBytes The lower 4 bytes of the ID
   * @param highBytes The upper 4 bytes of the ID
   * @returns an Id64 containing the hexadecimal string representation of the unsigned 64-bit integer which would result from the
   * operation lowBytes | (highBytes << 32).
   */
  public static fromUint32Pair(lowBytes: number, highBytes: number): Id64 {
    const localIdLow = lowBytes >>> 0;
    const localIdHigh = (highBytes & 0x000000ff) * (0xffffffff + 1); // aka (highBytes & 0xff) << 32
    const localId = localIdLow + localIdHigh; // aka localIdLow | localIdHigh

    const briefcaseId = (highBytes & 0xffffff00) >>> 8;

    return new Id64([localId, briefcaseId]);
  }

  /** Extract an unsigned 32-bit integer from the low 4 bytes of an Id64's value.
   * @returns the unsigned 32-bit integer value stored in the id's lower 4 bytes
   */
  public getLowUint32(): number { return Id64.getLowUint32(this); }

  /** Extract an unsigned 32-bit integer from the low 4 bytes of an Id64 string.
   * @returns the unsigned 32-bit integer value stored in the id's lower 4 bytes
   */
  public static getLowUint32(id: Id64String): number {
    if (this.isInvalidId(id))
      return 0;

    const str = id.toString();
    let start = 2;
    const len = str.length;
    if (len > 10)
      start = len - 8;

    return this.toHex(str.slice(start));
  }

  /** Extract an unsigned 32-bit integer from the high 4 bytes of an Id64's value.
   * @returns the unsigned 32-bit integer value stored in the id's upper 4 bytes
   */
  public getHighUint32(): number { return Id64.getHighUint32(this); }

  /** Extract an unsigned 32-bit integer from the high 4 bytes of an Id64 string.
   * @returns the unsigned 32-bit integer value stored in the id's upper 4 bytes
   */
  public static getHighUint32(id: Id64String): number {
    if (this.isInvalidId(id))
      return 0;

    const str = id.toString();
    const len = str.length;
    if (len <= 10)
      return 0;

    const start = len - 8;
    return this.toHex(str.slice(2, start));
  }

  /** Convert an Id64Arg into an Id64Set.
   * This method can be used by functions that accept an Id64Arg to conveniently process the value(s).
   *
   * For example:
   * ```ts
   *   public addCategories(arg: Id64Arg) { Id64.toIdSet(arg).forEach((id) => this.categories.add(id)); }
   * ```
   */
  public static toIdSet(arg: Id64Arg): Id64Set {
    if (arg instanceof Set)
      return arg;
    const ids = new Set<string>();
    if (typeof arg === "string")
      ids.add(arg);
    else if (arg instanceof Id64)
      ids.add(arg.value);
    else if (Array.isArray(arg)) {
      if (arg.length > 0) {
        (typeof arg[0] === "string") ? (arg as string[]).forEach((id) => ids.add(id)) : (arg as Id64[]).forEach((id) => ids.add(id.value));
      }
    }
    return ids;
  }

  /** Obtain an Id64 instance with an invalid value. */
  public static invalidId: Id64 = new Id64();

  /** Return whether this is a transient Id64. A transient ID is used to identify non-element entities like pickable decorations. */
  public get isTransient(): boolean { return Id64.isTransientId(this); }

  /** Return whether the supplied id string is a transient Id64. A transient ID is used to identify non-element entities like pickable decorations. */
  public static isTransientId(id: Id64String): boolean {
    // A transient ID is of the format "0xffffffxxxxxxxxxx" where the leading 6 digits indicate an invalid briefcase ID.
    const str = id.toString();
    return 18 === str.length && str.startsWith("0xffffff");
  }

  /** Return true if the supplied id string represents an invalid ID. */
  public static isInvalidId(id: Id64String): boolean { return "0" === id; }
}

/**
 * Generates unique Id64 values in sequence, which are guaranteed not to conflict with Id64s associated with persistent elements or models.
 * This is useful for associating stable, non-persistent identifiers with things like view decorations.
 * A TransientIdSequence can generate a maximum of (2^40)-2 unique IDs.
 */
export class TransientIdSequence {
  private _localId: number = 0;

  /** Generate and return the next transient Id64 in the sequence. */
  public get next(): Id64 { return new Id64([++this._localId, 0xffffff]); }
}

/** A string in the "8-4-4-4-12" pattern. Does not enforce that the Guid is a valid v4 format uuid.
 * @note Guid is an immutable class. Its value cannot be changed.
 */
export class Guid {
  public readonly value: string;
  private static _uuidPattern = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");

  public constructor(input?: Guid | string | boolean) {
    if (typeof input === "string") { this.value = input.toLowerCase(); if (Guid.isGuid(this.value)) return; }
    if (input instanceof Guid) { this.value = input.value; return; }
    if (typeof input === "boolean") { if (input) { this.value = Guid.createValue(); return; } }
    this.value = "";
  }
  public equals(other: Guid): boolean { return this.value === other.value; }
  public get isValid(): boolean { return this.value !== ""; }
  public toString(): string { return this.value; }
  public toJSON(): string { return this.value; }
  public static fromJSON(val?: GuidProps): Guid | undefined { return val ? new Guid(val) : undefined; }

  /** determine whether the input string is "guid-like". That is, it follows the 8-4-4-4-12 pattern. This does not enforce
   *  that the string is actually in valid UUID format.
   */
  public static isGuid(value: string) { return Guid._uuidPattern.test(value); }

  /** Determine whether the input string is a valid V4 Guid string */
  public static isV4Guid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value); }

  /** Create a new V4 Guid value */
  public static createValue(): string {
    // https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
