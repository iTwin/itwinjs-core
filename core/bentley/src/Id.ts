/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Ids
 */

import { Id64 as Id64L1 } from "./Id64L1";

/** A string containing a well-formed string representation of an [Id64]($core-bentley).
 * See [Working with Ids]($docs/learning/common/Id64.md).
 * @public
 */
export type Id64String = string;

/** A string containing a well-formed string representation of a [Guid]($core-bentley).
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
  export const getLocalId = Id64L1.getLocalId;

  /** Extract the briefcase Id portion of an Id64String, contained in the upper 24 bits of the 64-bit value. */
  export const getBriefcaseId = Id64L1.getBriefcaseId;

  /** Create an Id64String from its JSON representation.
   * @param prop The JSON representation of an Id.
   * @returns A well-formed Id string.
   * @note if the input is undefined, the result is "0", indicating an invalid Id.
   * @note if the input is not undefined, the result is the same as that of [[Id64.fromString]].
   */
  export const fromJSON = Id64L1.fromJSON;

  /** Given a string value, attempt to normalize it into a well-formed Id string.
   * If the input is already a well-formed Id string, it is returned unmodified.
   * Otherwise, the input is trimmed of leading and trailing whitespace, converted to lowercase, and an attempt is made to parse it as a 64-bit hexadecimal integer.
   * If parsing succeeds the normalized result is returned; otherwise the result is "0", indicating an invalid Id.
   *
   * For a description of "well-formed", see [Working with Ids]($docs/learning/common/Id64.md).
   */
  export const fromString = Id64L1.fromString;

  /** Produce an Id string from a local and briefcase Id.
   * @param localId The non-zero local Id as an unsigned 40-bit integer.
   * @param briefcaseId The briefcase Id as an unsigned 24-bit integer.
   * @returns an Id64String containing the hexadecimal string representation of the unsigned 64-bit integer which would result from the
   * operation `localId | (briefcaseId << 40)`, or an invalid Id "0" if the inputs are invalid.
   */
  export const fromLocalAndBriefcaseIds = Id64L1.fromLocalAndBriefcaseIds;

  /** Create an Id64String from a pair of unsigned 32-bit integers.
   * @param lowBytes The lower 4 bytes of the Id
   * @param highBytes The upper 4 bytes of the Id
   * @returns an Id64String containing the hexadecimal string representation of the unsigned 64-bit integer which would result from the
   * operation `lowBytes | (highBytes << 32)`.
   * @see [[Id64.fromUint32PairObject]] if you have a [[Id64.Uint32Pair]] object.
   */
  export const fromUint32Pair = Id64L1.fromUint32Pair;

  /** Create an Id64String from a [[Id64.Uint32Pair]].
   * @see [[Id64.fromUint32Pair]].
   */
  export const fromUint32PairObject = Id64L1.fromUint32PairObject;

  /** Returns true if the inputs represent two halves of a valid 64-bit Id.
   * @see [[Id64.Uint32Pair]].
   */
  export const isValidUint32Pair = Id64L1.isValidUint32Pair;

  /** Represents an unsigned 64-bit integer as a pair of unsigned 32-bit integers.
   * @see [[Id64.getUint32Pair]]
   * @see [[Id64.isValidUint32Pair]]
   */
  export type Uint32Pair = Id64L1.Uint32Pair;

  /** Convert an Id64String to a 64-bit unsigned integer represented as a pair of unsigned 32-bit integers.
   * @param id The well-formed string representation of a 64-bit Id.
   * @param out Used as the return value if supplied; otherwise a new object is returned.
   * @returns An object containing the parsed lower and upper 32-bit integers comprising the 64-bit Id.
   */
  export const getUint32Pair = Id64L1.getUint32Pair;

  /** Extract an unsigned 32-bit integer from the lower 4 bytes of an Id64String. */
  export const getLowerUint32 = Id64L1.getLowerUint32;

  /** Extract an unsigned 32-bit integer from the upper 4 bytes of an Id64String. */
  export const getUpperUint32 = Id64L1.getUpperUint32;

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
  export const toIdSet = Id64L1.toIdSet;

  /** Obtain iterator over the specified Ids.
   * @see [[Id64.iterable]].
   */
  export const iterator = Id64L1.iterator;

  /** Obtain an iterable over the specified Ids. Example usage:
   * ```ts
   *  const ids = ["0x123", "0xfed"];
   *  for (const id of Id64.iterable(ids))
   *    console.log(id);
   * ```
   */
  export const iterable = Id64L1.iterable;

  /** Return the first [[Id64String]] of an [[Id64Arg]]. */
  export const getFirst = Id64L1.getFirst;

  /** Return the number of [[Id64String]]s represented by an [[Id64Arg]]. */
  export const sizeOf = Id64L1.sizeOf;

  /** Returns true if the [[Id64Arg]] contains the specified Id. */
  export const has = Id64L1.has;

  /** The string representation of an invalid Id. */
  export const invalid =Id64L1.invalid;

  /** Determine if the supplied id string represents a transient Id.
   * @param id A well-formed Id string.
   * @returns true if the Id represents a transient Id.
   * @note This method assumes the input is a well-formed Id string.
   * @see [[Id64.isTransientId64]]
   * @see [[TransientIdSequence]]
   */
  export const isTransient = Id64L1.isTransient;

  /** Determine if the input is a well-formed [[Id64String]] and represents a transient Id.
   * @see [[Id64.isTransient]]
   * @see [[Id64.isId64]]
   * @see [[TransientIdSequence]]
   */
  export const isTransientId64 = Id64L1.isTransientId64;

  /** Determine if the input is a well-formed [[Id64String]].
   *
   * For a description of "well-formed", see [Working with Ids]($docs/learning/common/Id64.md).
   * @see [[Id64.isValidId64]]
   */
  export const isId64 = Id64L1.isId64;

  /** Returns true if the input is not equal to the representation of an invalid Id.
   * @note This method assumes the input is a well-formed Id string.
   * @see [[Id64.isInvalid]]
   * @see [[Id64.isValidId64]]
   */
  export const isValid = Id64L1.isValid;

  /** Returns true if the input is a well-formed [[Id64String]] representing a valid Id.
   * @see [[Id64.isValid]]
   * @see [[Id64.isId64]]
   */
  export const isValidId64 = Id64L1.isValidId64;

  /** Returns true if the input is a well-formed [[Id64String]] representing an invalid Id.
   * @see [[Id64.isValid]]
   */
  export const isInvalid = Id64L1.isInvalid;

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
  export class Uint32Set extends Id64L1.Uint32Set {}

  /** A specialized replacement for Map<Id64String, T> optimized for performance-critical code.
   * @see [[Id64.Uint32Set]] for implementation details.
   * @public
   */
  export class Uint32Map<T> extends Id64L1.Uint32Map<T> {}
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
