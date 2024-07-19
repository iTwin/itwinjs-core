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
 
export * from "./crv/CurveExtendMode";
export * from "./crv/CurveProcessor";
export * from "./crv/GeometryQuery";
export * from "./crv/CurvePrimitive";
export * from "./crv/ProxyCurve";
export * from "./crv/Arc3d";
export * from "./crv/LineSegment3d";
export * from "./crv/LineString3d";

export * from "./crv/CurveCollection";
export * from "./crv/Loop";
export * from "./crv/Path";

export * from "./crv/CurveTypes";
export * from "./crv/ConstructCurveBetweenCurves";
export * from "./crv/CoordinateXYZ";
export * from "./crv/CurveChainWithDistanceIndex";

export * from "./crv/CurveCurve";
export * from "./crv/CurveLocationDetail";
export * from "./crv/CurveFactory";
export * from "./crv/CurveOps";
export * from "./crv/OffsetOptions";
export * from "./crv/ParityRegion";
export * from "./crv/RegionMomentsXY";
export * from "./crv/RegionOps";
export * from "./crv/PointString3d";
export * from "./crv/StrokeOptions";
export * from "./crv/spiral/TransitionSpiral3d";
export * from "./crv/spiral/IntegratedSpiral3d";
export * from "./crv/spiral/DirectSpiral3d";
export * from "./crv/UnionRegion";
export * from "./crv/Query/StrokeCountMap";
