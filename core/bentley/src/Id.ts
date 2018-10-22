/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Ids */

import { assert } from "./Assert";

/**
 * A string containing a well-formed string representation of an [[Id64]].
 *
 * See [Working with IDs]($docs/learning/common/Id64.md).
 */
export type Id64String = string;

/** The properties of a GUID. When serialized, will always be a string. */
export type GuidProps = Guid | string;

/** A set of [[Id64String]]s. */
export type Id64Set = Set<Id64String>;

/** An array of [[Id64String]]s. */
export type Id64Array = Id64String[];

/** Used as an argument to a function that can accept one or more Id64 values. */
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
  if (charCode >= minDecimalDigit && charCode <= 0x39) // ...to '9'
    return true;
  else
    return charCode >= 0x61 && charCode <= 0x66; // 'a' to 'f'
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
 * A 64 bit ID, stored as a hex string. This is necessary since JavaScript does not intrinsically support 64-bit integers.
 *
 * See [Working with IDs]($docs/learning/common/Id64.md).
 * @note It is rarely useful to instantiate an instance of the Id64 class. Prefer to use [[Id64String]].
 * @note Id64 is an immutable class. Its value cannot be changed.
 * @see [[Id64String]]
 */
export class Id64 {
  /** The well-formed string representation of the 64-bit ID. */
  public readonly value: Id64String;

  protected toJSON(): string { return this.value; }

  /** Extract the "local" ID portion of an Id64 string, contained in the lower 40 bits of the 64-bit value. */
  public static getLocalId(id: Id64String): number {
    if (this.isInvalid(id))
      return 0;

    let start = 2;
    const len = id.length;
    if (len > 12)
      start = (len - 10);

    return toHex(id.slice(start));
  }

  /** Extract the briefcase ID portion of an Id64 string, contained in the upper 24 bits of the 64-bit value. */
  public static getBriefcaseId(id: Id64String): number {
    if (this.isInvalid(id))
      return 0;

    const str = id.toString();
    let start = 2;
    const len = str.length;
    if (len <= 12)
      return 0;

    start = (len - 10);
    return toHex(str.slice(2, start));
  }

  /** Wrap an Id64String in an instance of an Id64 object. This is useful only in rare scenarios in which type-switching on `instanceof Id64` is desired. */
  public static wrap(id: Id64String): Id64 {
    return new Id64(id);
  }

  private constructor(value: string) {
    assert(Id64.isId64(value));
    this.value = value;
  }

  /** Returns the underlying string representation of this ID. */
  public toString(): string { return this.value; }

  /** Determine whether this Id64 is valid.
   * @note The value of an invalid Id64 is "0".
   */
  public get isValid(): boolean { return this.value !== Id64.invalid; }

  /** Test whether two Id64s are the same
   * @param other the other Id64 to compare
   */
  public equals(other: Id64): boolean { return this.value === other.toString(); }

  /** Create an Id64 from its JSON representation.
   * @param prop The JSON representation of an ID.
   * @returns A well-formed ID string.
   * @note if the input is undefined, the result is "0", indicating an invalid ID.
   * @note if the input is not undefined, the result is the same as that of [[Id64.fromString]].
   */
  public static fromJSON(prop?: string): Id64String {
    return typeof prop === "string" ? Id64.fromString(prop) : Id64.invalid;
  }

  /** Given a string value, attempt to normalize it into a well-formed ID string.
   * If the input is already a well-formed ID string, it is returned unmodified.
   * Otherwise, the input is trimmed of leading and trailing whitespace, converted to lowercase, and an attempt is made to parse it as a 64-bit hexadecimal integer.
   * If parsing succeeds the normalized result is returned; otherwise the result is "0", indicating an invalid ID.
   *
   * For a description of "well-formed", see [Working with IDs]($docs/learning/common/Id64.md).
   */
  public static fromString(val: string): Id64String {
    // NB: Yes, we must check the run-time type...
    if (typeof val !== "string")
      return this.invalid;

    // Skip the common case in which the input is already a well-formed ID string
    if (Id64.isId64(val))
      return val;

    // Attempt to normalize the input into a well-formed ID string
    val = val.toLowerCase().trim();
    const len = val.length;
    if (len < 2 || val[0] !== "0" || val[1] !== "x")
      return this.invalid;

    let low = 0;
    let high = 0;
    let start = 2;
    if (len > 12) {
      start = (len - 10);
      high = toHex(val.slice(2, start));
    }

    low = toHex(val.slice(start));
    return this.fromLocalAndBriefcaseIds(low, high);
  }

  /** Produce an ID string from a local and briefcase ID.
   * @param localId The non-zero local ID as an unsigned 40-bit integer.
   * @param briefcaseId The briefcase ID as an unsigned 24-bit integer.
   * @returns an Id64String containing the hexadecimal string representation of the unsigned 64-bit integer which would result from the
   * operation `localId | (briefcaseId << 40)`, or an invalid ID "0" if the inputs are invalid.
   */
  public static fromLocalAndBriefcaseIds(localId: number, briefcaseId: number): Id64String {
    // NB: Yes, we must check the run-time type...
    if (typeof localId !== "number" || typeof briefcaseId !== "number")
      return this.invalid;

    localId = Math.floor(localId);
    if (0 === localId)
      return this.invalid;

    briefcaseId = Math.floor(briefcaseId);
    const lowStr = localId.toString(16);
    return "0x" + ((briefcaseId === 0) ? lowStr : (briefcaseId.toString(16) + ("0000000000" + lowStr).substr(-10)));
  }

  /** Create an Id64 from a pair of unsigned 32-bit integers.
   * @param lowBytes The lower 4 bytes of the ID
   * @param highBytes The upper 4 bytes of the ID
   * @returns an Id64String containing the hexadecimal string representation of the unsigned 64-bit integer which would result from the
   * operation `lowBytes | (highBytes << 32)`.
   */
  public static fromUint32Pair(lowBytes: number, highBytes: number): Id64String {
    const localIdLow = lowBytes >>> 0;
    const localIdHigh = (highBytes & 0x000000ff) * (0xffffffff + 1); // aka (highBytes & 0xff) << 32
    const localId = localIdLow + localIdHigh; // aka localIdLow | localIdHigh

    const briefcaseId = (highBytes & 0xffffff00) >>> 8;

    return Id64.fromLocalAndBriefcaseIds(localId, briefcaseId);
  }

  /** Extract an unsigned 32-bit integer from the lower 4 bytes of an Id64 string.
   * @returns the unsigned 32-bit integer value stored in the id's lower 4 bytes
   */
  public static getLowerUint32(id: Id64String): number {
    if (this.isInvalid(id))
      return 0;

    const str = id.toString();
    let start = 2;
    const len = str.length;
    if (len > 10)
      start = len - 8;

    return toHex(str.slice(start));
  }

  /** Extract an unsigned 32-bit integer from the upper 4 bytes of an Id64 string.
   * @returns the unsigned 32-bit integer value stored in the id's upper 4 bytes
   */
  public static getUpperUint32(id: Id64String): number {
    if (this.isInvalid(id))
      return 0;

    const len = id.length;
    if (len <= 10)
      return 0;

    const start = len - 8;
    return toHex(id.slice(2, start));
  }

  /** Convert an [[Id64Arg]] into an [[Id64Set]].
   *
   * This method can be used by functions that accept an Id64Arg to conveniently process the value(s). For example:
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
    else if (Array.isArray(arg)) {
      arg.forEach((id) => {
        if (typeof id === "string")
          ids.add(id);
      });
    }

    return ids;
  }

  /** The string representation of an invalid ID. */
  public static invalid = "0";

  /** An Id64 instance representing an invalid ID. */
  public static invalidId64: Id64 = new Id64(Id64.invalid);

  /** Determine if the supplied id string represents a transient ID.
   * @param id A well-formed ID string.
   * @returns true if the ID represents a transient ID.
   * @note This method assumes the input is a well-formed ID string.
   * @see [[isTransientId64]]
   * @see [[TransientIdSequence]]
   */
  public static isTransient(id: Id64String): boolean {
    // A transient ID is of the format "0xffffffxxxxxxxxxx" where the leading 6 digits indicate an invalid briefcase ID.
    const str = id.toString();
    return 18 === str.length && str.startsWith("0xffffff");
  }

  /** Determine if the input is a well-formed [[Id64String]] and represents a transient ID.
   * @see [[isTransient]]
   * @see [[isId64]]
   * @see [[TransientIdSequence]]
   */
  public static isTransientId64(id: string): boolean {
    return this.isValidId64(id) && this.isTransient(id);
  }

  /** Determine if the input is a well-formed [[Id64String]].
   *
   * For a description of "well-formed", see [Working with IDs]($docs/learning/common/Id64.md).
   * @see [[isValidId64]]
   */
  public static isId64(id: string): boolean {
    const len = id.length;
    if (0 === len)
      return false;

    if ("0" !== id[0])
      return false;

    // Well-formed invalid ID: "0"
    if (1 === len)
      return true;

    // Valid IDs begin with "0x" followed by at least one lower-case hexadecimal digit.
    if (2 === len || "x" !== id[1])
      return false;

    // If briefcase ID is present, it occupies at least one digit, followed by 10 digits for local ID
    let localIdStart = 2;
    if (len > 12) {
      localIdStart = len - 10;

      // Verify briefcase ID
      if (!isValidHexString(id, 2, localIdStart - 2))
        return false;

      // Skip leading zeroes in local ID
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

  /** Returns true if the input is not equal to the representation of an invalid ID.
   * @note This method assumes the input is a well-formed ID string.
   * @see [[isInvalid]]
   * @see [[isValidId64]]
   */
  public static isValid(id: Id64String): boolean {
    return Id64.invalid !== id;
  }

  /** Returns true if the input is a well-formed [[Id64String]] representing a valid ID.
   * @see [[isValid]]
   * @see [[isId64]]
   */
  public static isValidId64(id: string): boolean {
    return Id64.invalid !== id && Id64.isId64(id);
  }

  /** Returns true if the input is a well-formed [[Id64String]] representing an invalid ID.
   * @see [[isValid]]
   */
  public static isInvalid(id: Id64String): boolean {
    return Id64.invalid === id;
  }
}

/**
 * Generates unique [[Id64String]] values in sequence, which are guaranteed not to conflict with IDs associated with persistent elements or models.
 * This is useful for associating stable, non-persistent identifiers with things like [Decorator]($frontend)s.
 * A TransientIdSequence can generate a maximum of (2^40)-2 unique IDs.
 */
export class TransientIdSequence {
  private _localId: number = 0;

  /** Generate and return the next transient Id64 in the sequence. */
  public get next(): Id64String { return Id64.fromLocalAndBriefcaseIds(++this._localId, 0xffffff); }
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
