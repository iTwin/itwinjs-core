/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */

// import { Geometry, Angle, AngleSweep } from "../Geometry";

// import { Point3d, Vector3d, Matrix3d } from "../PointVector";
import { CurvePrimitive } from "./CurvePrimitive";

import { CurveCollection } from "./CurveCollection";
import { Path } from "./Path";
import { Loop } from "./Loop";
import { ParityRegion } from "./ParityRegion";
import { BagOfCurves } from "./CurveCollection";
import { UnionRegion } from "./UnionRegion";
export type AnyCurve = CurvePrimitive | Path | Loop | ParityRegion | UnionRegion | BagOfCurves | CurveCollection;
export type AnyRegion = Loop | ParityRegion | UnionRegion;
