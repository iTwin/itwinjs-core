/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Utility
 */

/** The ./curve/ directory contains tall class hierarchies and many circular file dependencies (A.ts imports from B.ts and B.ts also imports from A.ts, possibly indirectly).
 * This can result in run-time errors when the file defining a derived class is processed before the file containing its superclass.
 * To prevent that, curves.ts exports the contents of files in order based on the class hierarchies they contain: base classes before derived classes.
 * For it to work, every file in core-geometry must import other types within ./curve/ only via curves.ts - never directly.
 * A simple explanation: https://medium.com/visual-development/how-to-fix-nasty-circular-dependency-issues-once-and-for-all-in-javascript-typescript-a04c987cf0de
 */
 
export * from "./curve/CurveExtendMode";
export * from "./curve/CurveProcessor";
export * from "./curve/GeometryQuery";
export * from "./curve/CurvePrimitive";
export * from "./curve/ProxyCurve";
export * from "./curve/Arc3d";
export * from "./curve/LineSegment3d";
export * from "./curve/LineString3d";

export * from "./curve/CurveCollection";
export * from "./curve/Loop";
export * from "./curve/Path";

export * from "./curve/CurveTypes";
export * from "./curve/ConstructCurveBetweenCurves";
export * from "./curve/CoordinateXYZ";
export * from "./curve/CurveChainWithDistanceIndex";

export * from "./curve/CurveCurve";
export * from "./curve/CurveLocationDetail";
export * from "./curve/CurveFactory";
export * from "./curve/CurveOps";
export * from "./curve/OffsetOptions";
export * from "./curve/ParityRegion";
export * from "./curve/RegionMomentsXY";
export * from "./curve/RegionOps";
export * from "./curve/PointString3d";
export * from "./curve/StrokeOptions";
export * from "./curve/spiral/TransitionSpiral3d";
export * from "./curve/spiral/IntegratedSpiral3d";
export * from "./curve/spiral/DirectSpiral3d";
export * from "./curve/UnionRegion";
export * from "./curve/Query/StrokeCountMap";
