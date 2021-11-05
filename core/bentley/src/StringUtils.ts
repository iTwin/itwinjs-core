/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

// TextDecoder is not supported on all platforms - this is an alternative for utf-8.
// From https://github.com/AnalyticalGraphicsInc/cesium/blob/master/Source/Core/getStringFromTypedArray.js
// which is itself inspired by https://github.com/inexorabletash/text-encoding
/** @internal */
namespace Utf8ToString {
  function inRange(a: number, min: number, max: number): boolean { return min <= a && a <= max; }

  function utf8Handler(bytes: Uint8Array): number[] | undefined {
    let codePoint = 0;
    let bytesSeen = 0;
    let bytesNeeded = 0;
    let lowerBoundary = 0x80;
    let upperBoundary = 0xbf;

    const codePoints: number[] = [];
    const length = bytes.length;
    for (let i = 0; i < length; i++) {
      const currentByte = bytes[i];

      // If bytesNeeded = 0, then we are starting a new character
      if (0 === bytesNeeded) {
        // 1 byte ascii character
        if (inRange(currentByte, 0x00, 0x7f)) {
          // return a code point whose value is byte.
          codePoints.push(currentByte);
          continue;
        }

        // 2 byte character
        if (inRange(currentByte, 0xc2, 0xdf)) {
          bytesNeeded = 1;
          codePoint = currentByte & 0x1f;
          continue;
        }

        // 3 byte character
        if (inRange(currentByte, 0xe0, 0xef)) {
          if (0xe0 === currentByte)
            lowerBoundary = 0xa0;
          else if (0xed === currentByte)
            upperBoundary = 0x9f;

          bytesNeeded = 2;
          codePoint = currentByte & 0xf;
          continue;
        }

        // 4 byte character
        if (inRange(currentByte, 0xf0, 0xf4)) {
          if (0xf0 === currentByte)
            lowerBoundary = 0x90;
          else if (0xf4 === currentByte)
            upperBoundary = 0x8f;

          bytesNeeded = 3;
          codePoint = currentByte & 0x7;
          continue;
        }

        // invalid utf-8
        return undefined;
      }

      // out of range so ignore the first part(s) of the character and continue with this byte on its own
      if (!inRange(currentByte, lowerBoundary, upperBoundary)) {
        codePoint = bytesNeeded = bytesSeen = 0;
        lowerBoundary = 0x80;
        upperBoundary = 0xbf;
        --i;
        continue;
      }

      // set appropriate boundaries since we've now checked byte 2 of a potential longer character
      lowerBoundary = 0x80;
      upperBoundary = 0xbf;

      // add byte to code point
      codePoint = (codePoint << 6) | (currentByte & 0x3f);

      // We have the correct number of bytes, so push and reset for next character
      ++bytesSeen;
      if (bytesSeen === bytesNeeded) {
        codePoints.push(codePoint);
        codePoint = bytesNeeded = bytesSeen = 0;
      }
    }

    return codePoints;
  }

  export function decodeWithFromCharCode(view: Uint8Array): string | undefined {
    let result = "";
    const codePoints = utf8Handler(view);
    if (undefined === codePoints)
      return undefined;

    for (let cp of codePoints) {
      if (cp <= 0xffff) {
        result += String.fromCharCode(cp);
      } else {
        cp -= 0x10000;
        result += String.fromCharCode((cp >> 10) + 0xd800, (cp & 0x3ff) + 0xdc00);
      }
    }

    return result;
  }
}

/** Exposed only for testing the fall-back used when TextDecoder is unsupported.
 * @internal
 */
export function utf8ToStringPolyfill(utf8: Uint8Array): string | undefined {
  return Utf8ToString.decodeWithFromCharCode(utf8);
}

// TextDecoder unsupported in Edge at time of writing.
let textDecoderSupported = true;

/** Given an array of bytes containing a utf-8 string, convert to a string.
 * @param utf8: An array of utf-8 characters as a byte array
 * @returns An equivalent string, or undefined if the array does not contain a valid utf-8 string.
 * @note This function uses Javascript's TextDecoder if supported by the browser; otherwise, it
 * falls back to a less efficient polyfill.
 * @public
 */
export function utf8ToString(utf8: Uint8Array): string | undefined {
  let decoder: TextDecoder | undefined;
  if (textDecoderSupported) {
    try {
      decoder = new TextDecoder("utf-8");
    } catch (_ex) {
      textDecoderSupported = false;
    }
  }

  if (undefined !== decoder)
    return decoder.decode(utf8);
  else
    return utf8ToStringPolyfill(utf8);
}

/** Given a base-64-encoded string, decode it into an array of bytes.
 * @param base64 The base-64-encoded string.
 * @returns the decoded byte array.
 * @throws DOMException if the length of the input string is not a multiple of 4.
 * @public
 */
export function base64StringToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(atob(base64).split("").map((c) => c.charCodeAt(0))); // eslint-disable-line deprecation/deprecation
}
