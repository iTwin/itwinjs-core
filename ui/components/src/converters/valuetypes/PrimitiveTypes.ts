/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";

export type Text = string;
export type String = string;
export type ShortDate = string | Date;
export type Boolean = boolean | string | {} | [];
export type Float = number | string;
export type Int = number | string;
export type Hexadecimal = Id64String;
export type Enum = number | string;

export type Numeric = Float | Int;

export type Point2d = string[];
export type Point3d = string[];

export type Point = Point2d | Point3d;

// tslint:disable-next-line
export type Value = Text | String | ShortDate | Boolean | Numeric | Enum | Point;
