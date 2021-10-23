/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

// import { Geometry, Angle, AngleSweep } from "../Geometry";

import { CurveCollection } from "./CurveCollection";
// import { Point3d, Vector3d, Matrix3d } from "../PointVector";
import { CurvePrimitive } from "./CurvePrimitive";
import { Loop } from "./Loop";
import { ParityRegion } from "./ParityRegion";
import { UnionRegion } from "./UnionRegion";

/** Union type for `GeometryQuery` classes that have contain curves, either as individual parameter space or as collections
 * @public
 */
export type AnyCurve = CurvePrimitive | CurveCollection;

/** Union type for `GeometryQuery` classes that bound (planar) regions.
 * @public
 */
export type AnyRegion = Loop | ParityRegion | UnionRegion;
