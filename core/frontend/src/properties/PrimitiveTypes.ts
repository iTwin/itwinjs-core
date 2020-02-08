/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { Id64String } from "@bentley/bentleyjs-core";

/** Primitive Property Value Types.
 * @beta
 * @deprecated Move Primitives to bentley/ui-abstract beginning in iModel.js 2.0.
 */
export namespace Primitives {
  export type Text = string;
  export type String = string;
  export type ShortDate = string | Date;
  export type Boolean = boolean | string | {} | [];
  export type Float = number | string;
  export type Int = number | string;
  export type Hexadecimal = Id64String;
  export type Enum = number | string;

  export type Numeric = Float | Int;

  export type Point2d = string[] | number[] | { x: number, y: number };
  export type Point3d = string[] | number[] | { x: number, y: number, z: number };

  export type Point = Point2d | Point3d;

  export interface CompositePart {
    displayValue: string;
    rawValue: Value;
    typeName: string;
  }
  export interface Composite {
    separator: string;
    parts: CompositePart[];
  }

  // tslint:disable-next-line
  export type Value = Text | String | ShortDate | Boolean | Numeric | Enum | Point | Composite;
}
