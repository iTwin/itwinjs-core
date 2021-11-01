/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Entities
 */

import { Base64 } from "js-base64";

/** Represents an array of bytes encoded in base-64 with a prefix indicating the encoding, as required when converting EC properties of `binary` type to and from JSON.
 * @see [[TextureProps.data]] and [[BRepEntity.DataProps.data]] for examples of properties of this type.
 * @public
 */
export type Base64EncodedString = string;

/** Represents an array of bytes encoded in base-64 with a prefix indicating the encoding, as persisted in an [ECDb]($backend) for properties of `binary` type.
 * @public
 */
export namespace Base64EncodedString { // eslint-disable-line @typescript-eslint/no-redeclare
  /** The prefix prepended to the string identifying it as base-64-encoded. */
  export const prefix = "encoding=base64;";

  /** Encode an array of bytes into a Base64EncodedString. */
  export function fromUint8Array(bytes: Uint8Array): Base64EncodedString {
    return `${prefix}${Base64.fromUint8Array(bytes)}`;
  }

  /** Decode a Base64EncodedString into an array of bytes. */
  export function toUint8Array(base64: Base64EncodedString): Uint8Array {
    return Base64.toUint8Array(stripPrefix(base64));
  }

  /** Returns true if the input starts with [[Base64EncodedString.prefix]] indicating it is a well-formed Base64EncodedString. */
  export function hasPrefix(str: string): boolean {
    return str.startsWith(prefix);
  }

  /** Ensure that the base-64-encoded string starts with the [[Base64EncodedString.prefix]]. */
  export function ensurePrefix(base64: string): Base64EncodedString {
    return hasPrefix(base64) ? base64 : `${prefix}${base64}`;
  }

  /** Remove the [[Base64EncodedString.prefix]] from the string if present. */
  export function stripPrefix(base64: Base64EncodedString): string {
    return hasPrefix(base64) ? base64.substr(prefix.length) : base64;
  }

  /** A function suitable for use with `JSON.parse` to revive a Base64EncodedString into a Uint8Array. */
  export const reviver = (_name: string, value: any): any => {
    if (typeof value === "string" && hasPrefix(value))
      value = toUint8Array(value);

    return value;
  };

  /** A function suitable for use with `JSON.stringify` to serialize a Uint8Array as a Base64EncodedString. */
  export const replacer = (_name: string, value: any): any => {
    if (value && value.constructor === Uint8Array)
      value = fromUint8Array(value);

    return value;
  };
}
