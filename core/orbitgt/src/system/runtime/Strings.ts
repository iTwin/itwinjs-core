/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { AList } from "../collection/AList";

/**
 * Class Strings defines the common string tools.
 */
/** @internal */
export class Strings {
  /** The 'infinity' character */
  public static INFINITY: string = "\u221E";
  /** The 'double-quote' character */
  public static DQUOTE: string = '"';
  /** The 'single-quote' character */
  public static SQUOTE: string = "'";
  /** The 'tab' character */
  public static TAB: string = String.fromCharCode(9);
  /** The 'carriage return' character */
  public static CR: string = String.fromCharCode(13);
  /** The 'newline' (linux line terminator) character */
  public static NL: string = String.fromCharCode(10);
  /** The 'carriage return+newline' (dos line terminator) character sequence */
  public static CR_NL: string =
    String.fromCharCode(13) + String.fromCharCode(10);

  private constructor() {}

  public static getLength(value: string): int32 {
    return value.length;
  }

  public static getCharAt(value: string, index: int32): int16 {
    return value.charCodeAt(index);
  }

  public static appendChar(value: string, charCode: int16): string {
    return value + String.fromCharCode(charCode);
  }

  public static prependChar(value: string, charCode: int16): string {
    return String.fromCharCode(charCode) + value;
  }

  public static equals(value1: string, value2: string): boolean {
    if (value1 == null) return value2 == null;
    if (value2 == null) return false;
    return value1 === value2;
  }

  public static equalsIgnoreCase(value1: string, value2: string): boolean {
    if (value1 == null) return value2 == null;
    if (value2 == null) return false;
    return value1.toLowerCase() === value2.toLowerCase();
  }

  public static startsWith(value: string, prefix: string): boolean {
    return value.startsWith(prefix);
  }

  public static endsWith(value: string, suffix: string): boolean {
    return value.endsWith(suffix);
  }

  public static substring(value: string, index0: int32, index1: int32): string {
    return value.substring(index0, index1);
  }

  public static substringFrom(value: string, index: int32): string {
    return value.substring(index);
  }

  public static charCodeAt(value: string, index: int32): int32 {
    return value.charCodeAt(index);
  }

  public static charCodeToString(code: int32): string {
    return String.fromCharCode(code);
  }

  public static indexOf(value: string, part: string): int32 {
    return value.indexOf(part);
  }

  public static lastIndexOf(value: string, part: string): int32 {
    return value.lastIndexOf(part);
  }

  public static indexOfFrom(value: string, part: string, index: int32): int32 {
    return value.indexOf(part, index);
  }

  public static compareTo(value1: string, value2: string): int32 {
    if (value1 === value2) return 0;
    return value1 < value2 ? -1 : 1;
  }

  public static compareToIgnoreCase(value1: string, value2: string): int32 {
    return Strings.compareTo(value1.toLowerCase(), value2.toLowerCase());
  }

  public static splitAsList(value: string, separators: string): AList<string> {
    /* Null? */
    if (value == null) return null;
    /* Make a list of parts */
    let parts: AList<string> = new AList<string>();
    /* Fast-out */
    if (value.length == 0) return parts;
    /* Make a list of parts */
    while (true) {
      /* Get the index of the next separator */
      let index: int32 = value.length;
      for (let i: int32 = 0; i < separators.length; i++) {
        let nextIndex: int32 = value.indexOf(separators.charAt(i));
        if (nextIndex >= 0 && nextIndex < index) index = nextIndex;
      }
      /* None remaining ? */
      if (index == value.length) {
        /* Done */
        parts.add(value);
        break;
      } else {
        /* Add a substring */
        parts.add(value.substring(0, index));
        value = value.substring(index + 1);
      }
    }
    /* Return the parts */
    return parts;
  }

  public static splitAdvanced(
    value: string,
    separators: string,
    opens: string,
    closes: string,
    literals: string
  ): AList<string> {
    /* Check the value */
    if (value == null) return null;
    /* Check the parameters */
    if (separators == null) separators = "";
    if (opens == null) opens = "";
    if (closes == null) closes = "";
    if (literals == null) literals = "";
    /* Make a list of parts */
    let parts: AList<string> = new AList<string>();
    /* Check all characters in the value */
    let level: int32 = 0;
    let start: int32 = 0;
    let literal: string = null;
    for (let i: int32 = 0; i < value.length; i++) {
      /* Get the next character */
      let c: string = value.substring(i, i + 1);
      /* Escaped character ? */
      if (i > 0 && value.substring(i - 1, i) === "\\") continue;
      /* Quote bound ? */
      if (
        literal != null
          ? literal === c
          : literals.length > 0 && literals.indexOf(c) >= 0
      ) {
        /* Toggle */
        literal = literal == null ? c : null;
        continue;
      }
      /* Ignore this character ? */
      if (literal != null) continue;
      /* Separator ? */
      if (separators.indexOf(c) >= 0 && level == 0) {
        /* Get the part */
        parts.add(value.substring(start, i));
        start = i + 1;
      } else if (opens.indexOf(c) >= 0) {
        /* Open ? */
        level += 1;
      } else if (closes.indexOf(c) >= 0) {
        /* Close ? */
        level -= 1;
      }
    }
    /* Add the last part */
    parts.add(value.substring(start));
    /* Return the parts */
    return parts;
  }

  public static trim(value: string): string {
    return value.trim();
  }

  public static replace(line: string, key: string, value: string): string {
    return line.replace(key, value);
  }
}
