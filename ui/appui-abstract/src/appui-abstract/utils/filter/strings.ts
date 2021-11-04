/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CharCode } from "./charCode";

/**
 * @internal
 */
export function convertSimple2RegExpPattern(pattern: string): string {
  return pattern.replace(/[\-\\\{\}\+\?\|\^\$\.\,\[\]\(\)\#\s]/g, "\\$&").replace(/[\*]/g, ".*");
}

/**
 * @internal
 */
export function isLowerAsciiLetter(code: number): boolean {
  return code >= CharCode.a && code <= CharCode.z;
}

/**
 * @internal
 */
export function isUpperAsciiLetter(code: number): boolean {
  return code >= CharCode.A && code <= CharCode.Z;
}

/**
 * @internal
 */
function isAsciiLetter(code: number): boolean {
  return isLowerAsciiLetter(code) || isUpperAsciiLetter(code);
}

/**
 * @internal
 */
export function equalsIgnoreCase(a: string, b: string): boolean {
  return a.length === b.length && doEqualsIgnoreCase(a, b);
}

/**
 * @internal
 */
function doEqualsIgnoreCase(a: string, b: string, stopAt = a.length): boolean {
  for (let i = 0; i < stopAt; i++) {
    const codeA = a.charCodeAt(i);
    const codeB = b.charCodeAt(i);

    if (codeA === codeB) {
      continue;
    }

    // a-z A-Z
    if (isAsciiLetter(codeA) && isAsciiLetter(codeB)) {
      const diff = Math.abs(codeA - codeB);
      if (diff !== 0 && diff !== 32) {
        return false;
      }
    } else {
      // Any other char code
      if (String.fromCharCode(codeA).toLowerCase() !== String.fromCharCode(codeB).toLowerCase()) {
        return false;
      }
    }
  }

  return true;
}

/**
 * @internal
 */
export function startsWithIgnoreCase(str: string, candidate: string): boolean {
  const candidateLength = candidate.length;
  if (candidate.length > str.length) {
    return false;
  }

  return doEqualsIgnoreCase(str, candidate, candidateLength);
}
