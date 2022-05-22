/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

// cSpell:ignore shortdate

/**
 * Standard Type Names for converters and editors.
 * @public
 */
export enum StandardTypeNames {
  Text = "text",
  String = "string",
  DateTime = "dateTime",  // locale specific
  ShortDate = "shortdate", // locale specific
  Boolean = "boolean",
  Bool = "bool",
  Float = "float",
  Double = "double",
  Int = "int",
  Integer = "integer",
  Number = "number",
  Hexadecimal = "hexadecimal",
  Hex = "hex",
  Enum = "enum",
  Point2d = "point2d",
  Point3d = "point3d",
  Navigation = "navigation",
  Composite = "composite",
  Array = "array",
  Struct = "struct",
  URL = "url",
}
