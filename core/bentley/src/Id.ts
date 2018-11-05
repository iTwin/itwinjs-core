/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Ids */

/**
 * A string containing a well-formed string representation of an [[Id64]].
 *
 * See [Working with Ids]($docs/learning/common/Id64.md).
 */
export type Id64String = string;

/**
 * A string containing a well-formed string representation of a [[Guid]].
 */
export type GuidString = string;

/** A set of [[Id64String]]s. */
export type Id64Set = Set<Id64String>;

/** An array of [[Id64String]]s. */
export type Id64Array = Id64String[];

/** Used as an argument to a function that can accept one or more [[Id64String]]s. */
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
 * The Id64 namespace provides facilities for working with 64-bit identifiers. These Ids are stored as 64-bit integers inside an [[IModelDb]], but must be represented
 * as strings in JavaScript because JavaScript does not intrinsically support 64-bit integers.
 *
 * The [[Id64String]] type alias is used to indicate function arguments, return types, and variables which are known to contain a well-formed representation of a 64-bit Id.
 *
 * See [Working with Ids]($docs/learning/common/Id64.md) for a detailed description and code examples.
 */
export namespace Id64 {
  /** Extract the "local" Id portion of an Id64String, contained in the lower 40 bits of the 64-bit value. */
  export function getLocalId(id: Id64String): number {
    if (isInvalid(id))
      return 0;

    let start = 2;
    const len = id.length;
    if (len > 12)
      start = (len - 10);

    return toHex(id.slice(start));
  }

  /** Extract the briefcase Id portion of an Id64String, contained in the upper 24 bits of the 64-bit value. */
  export function getBriefcaseId(id: Id64String): number {
    if (isInvalid(id))
      return 0;

    const str = id.toString();
    let start = 2;
    const len = str.length;
    if (len <= 12)
      return 0;

    start = (len - 10);
    return toHex(str.slice(2, start));
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
    // NB: Yes, we must check the run-time type...
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
    return "0x" + ((briefcaseId === 0) ? lowStr : (briefcaseId.toString(16) + ("0000000000" + lowStr).substr(-10)));
  }

  /** Create an Id64String from a pair of unsigned 32-bit integers.
   * @param lowBytes The lower 4 bytes of the Id
   * @param highBytes The upper 4 bytes of the Id
   * @returns an Id64String containing the hexadecimal string representation of the unsigned 64-bit integer which would result from the
   * operation `lowBytes | (highBytes << 32)`.
   */
  export function fromUint32Pair(lowBytes: number, highBytes: number): Id64String {
    const localIdLow = lowBytes >>> 0;
    const localIdHigh = (highBytes & 0x000000ff) * (0xffffffff + 1); // aka (highBytes & 0xff) << 32
    const localId = localIdLow + localIdHigh; // aka localIdLow | localIdHigh

    const briefcaseId = (highBytes & 0xffffff00) >>> 8;

    return Id64.fromLocalAndBriefcaseIds(localId, briefcaseId);
  }

  /** Extract an unsigned 32-bit integer from the lower 4 bytes of an Id64String.
   * @returns the unsigned 32-bit integer value stored in the id's lower 4 bytes
   */
  export function getLowerUint32(id: Id64String): number {
    if (isInvalid(id))
      return 0;

    const str = id.toString();
    let start = 2;
    const len = str.length;
    if (len > 10)
      start = len - 8;

    return toHex(str.slice(start));
  }

  /** Extract an unsigned 32-bit integer from the upper 4 bytes of an Id64String.
   * @returns the unsigned 32-bit integer value stored in the id's upper 4 bytes
   */
  export function getUpperUint32(id: Id64String): number {
    if (isInvalid(id))
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
  export function toIdSet(arg: Id64Arg): Id64Set {
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

  /** The string representation of an invalid Id. */
  export const invalid = "0";

  /** Determine if the supplied id string represents a transient Id.
   * @param id A well-formed Id string.
   * @returns true if the Id represents a transient Id.
   * @note This method assumes the input is a well-formed Id string.
   * @see [[isTransientId64]]
   * @see [[TransientIdSequence]]
   */
  export function isTransient(id: Id64String): boolean {
    // A transient Id is of the format "0xffffffxxxxxxxxxx" where the leading 6 digits indicate an invalid briefcase Id.
    const str = id.toString();
    return 18 === str.length && str.startsWith("0xffffff");
  }

  /** Determine if the input is a well-formed [[Id64String]] and represents a transient Id.
   * @see [[isTransient]]
   * @see [[isId64]]
   * @see [[TransientIdSequence]]
   */
  export function isTransientId64(id: string): boolean {
    return isValidId64(id) && isTransient(id);
  }

  /** Determine if the input is a well-formed [[Id64String]].
   *
   * For a description of "well-formed", see [Working with Ids]($docs/learning/common/Id64.md).
   * @see [[isValidId64]]
   */
  export function isId64(id: string): boolean {
    const len = id.length;
    if (0 === len)
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
   * @see [[isInvalid]]
   * @see [[isValidId64]]
   */
  export function isValid(id: Id64String): boolean {
    return Id64.invalid !== id;
  }

  /** Returns true if the input is a well-formed [[Id64String]] representing a valid Id.
   * @see [[isValid]]
   * @see [[isId64]]
   */
  export function isValidId64(id: string): boolean {
    return Id64.invalid !== id && Id64.isId64(id);
  }

  /** Returns true if the input is a well-formed [[Id64String]] representing an invalid Id.
   * @see [[isValid]]
   */
  export function isInvalid(id: Id64String): boolean {
    return Id64.invalid === id;
  }
}

/**
 * Generates unique [[Id64String]] values in sequence, which are guaranteed not to conflict with Ids associated with persistent elements or models.
 * This is useful for associating stable, non-persistent identifiers with things like [Decorator]($frontend)s.
 * A TransientIdSequence can generate a maximum of (2^40)-2 unique Ids.
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
 */
export namespace Guid {
  const uuidPattern = new RegExp("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

  /** determine whether the input string is "guid-like". That is, it follows the 8-4-4-4-12 pattern. This does not enforce
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
}
