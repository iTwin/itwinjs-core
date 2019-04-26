/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */

// import { Geometry, Angle, AngleSweep } from "../Geometry";

// import { Point3d, Vector3d, Matrix3d } from "../PointVector";
import { CurvePrimitive } from "./CurvePrimitive";

import { CurveCollection, BagOfCurves } from "./CurveCollection";
import { Path } from "./Path";
import { Loop } from "./Loop";
import { ParityRegion } from "./ParityRegion";
import { UnionRegion } from "./UnionRegion";
/** Union type for `GeometryQuery` classes that have contain curves, either as individual parameter space or as collections
 * @public
 */
export type AnyCurve = CurvePrimitive | Path | Loop | ParityRegion | UnionRegion | BagOfCurves | CurveCollection;
/** Union type for `GeometryQuery` classes that bound (planar) regions.
 * @public
 */
export type AnyRegion = Loop | ParityRegion | UnionRegion;
