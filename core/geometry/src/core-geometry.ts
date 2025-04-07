/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Utility
 */

// REMARK:
// The docs-group-description comments are followed by empty classes with names corresponding to the doc-group.
// Normally (in committed code) these are commented out.
// The comments have distinctive strings so that simple search and replace can make the "real".
// This is useful when working on the documentation:  When the empty classes are present, VSCode will format the doc comments
// for and display them when the mouse hovers over the class name.

/**
 * @docs-package-description
 * The core-geometry package contains classes for working with geometry:  points, vectors, curves, surfaces, and analytic solids
 */
/**
 * @docs-group-description CartesianGeometry
 * Points, Vectors, Planes, and Transformations for x,y,z geometry.
 * * Fundamental cartesian geometry objects:
 *   * Point2d, Point3d -- points with x,y,z coordinates
 *   * Vector2d, Vector3d -- vectors with x,y,z coordinates
 *   * Matrix3d -- 3x3 matrix
 *   * * commonly used for pure rotations
 *   * * scale and skew entries are also allowed.
 *   * Transform -- an origin and axes.
 *   * Range1d, Range2d, Range3d -- subsets of 1d, 2d, and 3d space bounded by low and high values.
 *   * Ray3d -- a ray defined by origin and direction vector
 *   * Plane3d -- an abstract base class extended by Plane3dByOriginAndNormal, Plane3dByOriginAndUnitNormal, Point4d, and ClipPlane
 *   * Plane3dByOriginAndUnitNormal -- a plane defined by an origin and a single vector which is perpendicular to the plane
 *   * plane3dByOriginAndVectors -- a plane defined by an origin and two vectors in the plane.
 * * Angles
 *   * Angle -- a strongly typed angle object whose method names make it clear whether input and outputs are degrees or radians.
 *   * AngleSweep -- an angular interval
 *   * LatitudeLongitudeNumber -- carrier for position and altitude on sphere or ellipsoid
 *   * YawPitchAndRollAngles -- 3 angles that define a rotated coordinate system.
 * * Utility classes
 *   * FrameBuilder -- construction of coordinate frames from mixed data sources.
 *   * ClipPlane -- a single plane
 *   * ConvexClipPlaneSet -- an array of planes bounding a convex volume
 *   * ClipPlaneSet -- an array of ConvexClipPlaneSet, defining the union of their volumes
 *   * BilinearPatch -- twisted quadrilateral defined by 4 points
 *   * BarycentricTriangle -- triangle defined by 3 points.
 *   * Constant -- various numeric values exported as readonly constants
 */
// doc:export class CartesianGeometryDoc { }
/**
 * @docs-group-description ArraysAndInterfaces
 * These classes support array operations and inheritance-based algorithms.
 * * Arrays
 *   * GrowableArray -- A carrier for a Float64Array, with methods that hide reallocation of the underlying array as contents are added.
 *   * Point2dArray, Point3dArray, Point4dArray, Vector3dArray -- miscellaneous operations on arrays of 2d and 3d points.
 * * Interfaces
 *   * GeometryHandler -- a double-dispatch protocol used for efficient implementation of algorithms that work on many geometry types.
 *
 */
// doc:export class ArraysAndInterfacesDoc { }

/**
 * @docs-group-description Bspline
 * A bspline curve or surface is used for curved freeform geometry defined by controls points (sometimes called poles).
 * * BSplineCurve --  a curve defined by control points (which are not on the curve)
 * * InterpolationCurve -- a curve defined by passthrough points, with "good" visual properties
 * * BSplineSurfaceXYZ -- a surface with XYZ
 * * BsplineSurfaceXYZW -- a surface with weighted (rational) XYZ coordinates
 * * KnotVector -- vector of breakpoints in bspline definitions.
 */
// doc:export class BsplineDoc { }

/**
 * @docs-group-description Curve
 * Curves in the GeometryQuery hierarchy: LineSegment3d, LineString3d, Arc3d, TransitionSpiral3d
 * * CurvePrimitive -- base class for parametric curves
 *   * LineSegment3d -- a (bounded) portion of an unbounded line
 *   * Arc3d -- a circular or elliptic arc
 *   * LineString3d -- a sequence of points joined by line segments
 *   * TransitionSpiral -- controlled transition between curvatures
 * * Support classes
 * * PointString3d -- a sequence of isolated points
 * * StrokeOptions -- tolerances to describe stroking accuracy
 * * RecursiveCurveProcessor, RecursiveCurveProcessorWithStack -- algorithmic support for trees with CurvePrimitives at the leaf level.
 */
// doc:export class CurveDoc { }
/**
 * @docs-group-description Numerics
 * The Numerics classes have geometric and numeric methods used during large algorithms in other classes.
 */
// doc:export class NumericsDoc { }
/**
 * @docs-group-description Polyface
 * A Polyface is a mesh structure with arrays of points that are shared among multiple incident facets.
 */
// doc:export class PolyfaceDoc { }
/**
 * @docs-group-description Serialization
 * These classes are related to serialization of geometry classes.
 * * IModelJson.Reader, IModelJson.Writer -- Conversion of in-memory geometry objects to json objects for persistence and transmission.
 */
// doc:export class SerializationDoc { }
/**
 * @docs-group-description Solid
 * Analytic Solids in the GeometryQuery hierarchy: Box, Sphere, Cone, TorusPipe, LinearSweep, RotationalSweep, RuledSweep
 * * Box -- a box solid.  This is usually rectangular on all faces, but can in one directly like a view frustum
 * * Sphere -- a sphere
 * * Cone -- a cone or cylinder
 * * TorusPipe -- a pipe elbow
 * * LinearSweep -- a linear sweep of a base contour
 * * RotationalSweep -- a rotational sweep of a base contour
 * * RuledSweep -- two or more similarly structured contours joined by linear rule lines.
 */
// doc:export class SolidDOc { }
/**
 * @docs-group-description Topology
 * The Topology classes provide adjacency structures used in triangulations.
 */
// doc:export class TopologyDoc { }
/**
 * @docs-group-description RangeSearch
 * Support classes for searching collections of ranges.
 */
export * from "./geometry3d/Angle.js";
export * from "./geometry3d/AngleSweep.js";
export * from "./geometry3d/LongitudeLatitudeAltitude.js";
export * from "./geometry3d/BarycentricTriangle.js";
export * from "./geometry3d/BilinearPatch.js";
export * from "./geometry3d/Ellipsoid.js";
export * from "./geometry3d/FrameBuilder.js";
export * from "./geometry3d/FrustumAnimation.js";
export * from "./geometry3d/GeometryHandler.js";
export * from "./geometry3d/GrowableBlockedArray.js";
export * from "./geometry3d/GrowableFloat64Array.js";
export * from "./geometry3d/GrowableXYArray.js";
export * from "./geometry3d/GrowableXYZArray.js";
export * from "./geometry3d/IndexedCollectionInterval.js";
export * from "./geometry3d/IndexedXYCollection.js";
export * from "./geometry3d/IndexedXYZCollection.js";
export * from "./geometry3d/Matrix3d.js";
export * from "./geometry3d/OrderedRotationAngles.js";
export * from "./geometry3d/Plane3d.js";
export * from "./geometry3d/Plane3dByOriginAndUnitNormal.js";
export * from "./geometry3d/Plane3dByOriginAndVectors.js";
export * from "./geometry3d/Point2dArrayCarrier.js";
export * from "./geometry3d/Point2dVector2d.js";
export * from "./geometry3d/Point3dVector3d.js";
export * from "./geometry3d/PointHelpers.js";
export * from "./geometry3d/Point3dArrayCarrier.js";
export * from "./geometry3d/PolylineOps.js";
export * from "./geometry3d/PolygonOps.js";
export * from "./geometry3d/Range.js";
export * from "./geometry3d/Ray2d.js";
export * from "./geometry3d/Ray3d.js";
export * from "./geometry3d/Segment1d.js";
export * from "./geometry3d/Transform.js";
export * from "./geometry3d/UVSurfaceOps.js";
export * from "./geometry3d/XYZProps.js";
export * from "./geometry3d/YawPitchRollAngles.js";

export * from "./Geometry.js";
export * from "./Constant.js";
export * from "./clipping/BooleanClipFactory.js";
export * from "./clipping/ClipPlane.js";
export * from "./clipping/ConvexClipPlaneSet.js";
export * from "./clipping/UnionOfConvexClipPlaneSets.js";
export * from "./clipping/ClipPrimitive.js";
export * from "./clipping/ClipVector.js";
export * from "./clipping/ClipUtils.js";
export * from "./numerics/ConvexPolygon2d.js";
export * from "./geometry4d/PlaneByOriginAndVectors4d.js";
export * from "./geometry4d/Point4d.js";
export * from "./geometry4d/Matrix4d.js";
export * from "./geometry4d/Map4d.js";
export * from "./geometry4d/MomentData.js";
export * from "./numerics/BezierPolynomials.js";
export * from "./numerics/ClusterableArray.js";
export * from "./numerics/Complex.js";
export * from "./numerics/ConvexPolygon2d.js";
export * from "./numerics/PascalCoefficients.js";
export * from "./numerics/Quadrature.js";
export * from "./numerics/Range1dArray.js";
export * from "./numerics/SmallSystem.js";
export * from "./numerics/TriDiagonalSystem.js";

export * from "./curve/Arc3d.js";
export * from "./curve/ConstructCurveBetweenCurves.js";
export * from "./curve/CoordinateXYZ.js";
export * from "./curve/CurveTypes.js";
export * from "./curve/CurveChainWithDistanceIndex.js";
export * from "./curve/CurveExtendMode.js";
export * from "./curve/CurveCollection.js";
export * from "./curve/CurveCurve.js";
export * from "./curve/CurveLocationDetail.js";
export * from "./curve/CurveFactory.js";
export * from "./curve/CurveOps.js";
export * from "./curve/CurvePrimitive.js";
export * from "./curve/CurveProcessor.js";
export * from "./curve/GeometryQuery.js";
export * from "./curve/LineSegment3d.js";
export * from "./curve/LineString3d.js";
export * from "./curve/Loop.js";
export * from "./curve/OffsetOptions.js";
export * from "./curve/ParityRegion.js";
export * from "./curve/Path.js";
export * from "./curve/RegionMomentsXY.js";
export * from "./curve/RegionOps.js";
export * from "./curve/PointString3d.js";
export * from "./curve/ProxyCurve.js";
export * from "./curve/StrokeOptions.js";
export * from "./curve/spiral/TransitionSpiral3d.js";
export * from "./curve/spiral/IntegratedSpiral3d.js";
export * from "./curve/spiral/DirectSpiral3d.js";
export * from "./curve/UnionRegion.js";
export * from "./curve/Query/StrokeCountMap.js";
export * from "./solid/Box.js";
export * from "./solid/Cone.js";
export * from "./solid/LinearSweep.js";
export * from "./solid/RotationalSweep.js";
export * from "./solid/RuledSweep.js";
export * from "./solid/SolidPrimitive.js";
export * from "./solid/Sphere.js";
export * from "./solid/SweepContour.js";
export * from "./solid/TorusPipe.js";
export * from "./bspline/AkimaCurve3d.js";
export * from "./bspline/Bezier1dNd.js";
export * from "./bspline/BezierCurveBase.js";
export * from "./bspline/BezierCurve3d.js";
export * from "./bspline/BezierCurve3dH.js";
export * from "./bspline/BSplineCurve.js";
export * from "./bspline/BSplineCurveOps.js";
export * from "./bspline/BSpline1dNd.js";
export * from "./bspline/BSplineCurve3dH.js";
export * from "./bspline/BSplineSurface.js";
export * from "./bspline/InterpolationCurve3d.js";
export * from "./bspline/KnotVector.js";
export * from "./polyface/AuxData.js";
export * from "./polyface/BoxTopology.js";
export * from "./polyface/FacetFaceData.js";
export * from "./polyface/Polyface.js";
export * from "./polyface/FacetLocationDetail.js";
export * from "./polyface/IndexedPolyfaceVisitor.js";
export * from "./polyface/IndexedPolyfaceWalker.js";
export * from "./polyface/multiclip/GriddedRaggedRange2dSet.js";
export * from "./polyface/multiclip/GriddedRaggedRange2dSetWithOverflow.js";
export * from "./polyface/PolyfaceBuilder.js";
export * from "./polyface/PolyfaceData.js";
export * from "./polyface/PolyfaceQuery.js";
export * from "./polyface/PolyfaceClip.js";
export * from "./polyface/RangeTree/Point3dArrayRangeTreeContext.js";
export * from "./polyface/RangeTree/LineString3dRangeTreeContext.js";
export * from "./polyface/RangeTree/PolyfaceRangeTreeContext.js";
export * from "./polyface/TaggedNumericData.js";
export * from "./topology/SpaceTriangulation.js";
export * from "./serialization/IModelJsonSchema.js";
export * from "./serialization/DeepCompare.js";
export * from "./serialization/GeometrySamples.js";
export * from "./serialization/SerializationHelpers.js";
export { BentleyGeometryFlatBuffer } from "./serialization/BentleyGeometryFlatBuffer.js";
