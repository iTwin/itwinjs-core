/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import type { CurveCollection } from "./CurveCollection";
import type { CurvePrimitive } from "./CurvePrimitive";
import type { Loop } from "./Loop";
import type { ParityRegion } from "./ParityRegion";
import type { UnionRegion } from "./UnionRegion";

/**
 * Union type for `GeometryQuery` classes that have contain curves, either as individual parameter space or as collections
 * @public
 */
export type AnyCurve = CurvePrimitive | CurveCollection;

/**
 * Union type for `GeometryQuery` classes that bound (planar) regions.
 * @public
 */
export type AnyRegion = Loop | ParityRegion | UnionRegion;
