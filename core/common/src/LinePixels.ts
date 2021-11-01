/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

/** Enumerates the available patterns for drawing patterned lines.
 * Each is a 32-bit pattern in which each bit specifies the on- or off-state of a pixel along the line. The pattern repeats along the length of the entire line.
 * @public
 */
export enum LinePixels {
  /** A solid line. */
  Solid = 0,
  /** A solid line. */
  Code0 = Solid,
  /** 1 lit pixel followed by 7 unlit pixels: =&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;=&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= */
  Code1 = 0x80808080,
  /** 5 lit pixels followed by 3 unlit pixels: =====&nbsp;&nbsp;&nbsp;=====&nbsp;&nbsp;&nbsp;===== */
  Code2 = 0xf8f8f8f8,
  /** 11 lit pixels followed by 5 unlit pixels: ===========&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;=========== */
  Code3 = 0xffe0ffe0,
  /** 7 lit pixels followed by 4 unlit pixels followed by 1 lit pixel followed by 1 lit pixel: =======&nbsp;&nbsp;&nbsp;&nbsp;=&nbsp;&nbsp;&nbsp;&nbsp;=======&nbsp;&nbsp;&nbsp;&nbsp;= */
  Code4 = 0xfe10fe10,
  /** 3 lit pixels followed by 5 unlit pixels: ===&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;===&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;=== */
  Code5 = 0xe0e0e0e0,
  /** 5 lit pixels followed by 3 unlit followed by 1 lit followed by 3 unlit followed by 1 lit followed by 3 unlit: =====&nbsp;&nbsp;&nbsp;=&nbsp;&nbsp;&nbsp;=&nbsp;&nbsp;&nbsp;===== */
  Code6 = 0xf888f888,
  /** 8 lit pixels followed by 3 unlit followed by 2 lit followed by 3 unlit: ========&nbsp;&nbsp;&nbsp;==&nbsp;&nbsp;&nbsp;======== */
  Code7 = 0xff18ff18,
  /** 2 lit pixels followed by 2 unlit pixels - default style for drawing hidden edges: ==&nbsp;&nbsp;==&nbsp;&nbsp;==&nbsp;&nbsp;== */
  HiddenLine = 0xcccccccc,
  /** Barely visible - 1 lit pixel followed by 31 unlit pixels. */
  Invisible = 0x00000001,
  /** Indicates no valid line style or none specified, depending on context. */
  Invalid = -1,
}
