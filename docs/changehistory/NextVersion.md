---
publish: false
---
# NextVersion

Table of contents:

- [Electron 36 support](#electron-36-support)
- [API deprecations](#api-deprecations)
  - [@itwin/presentation-common](#itwinpresentation-common)
  - [@itwin/presentation-backend](#itwinpresentation-backend)
  - [@itwin/presentation-frontend](#itwinpresentation-frontend)
- [Geometry](#geometry)
  - [@itwin/geometry](#itwingeometry)

## Electron 36 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 36](https://www.electronjs.org/blog/electron-36-0).

## API deprecations

### @itwin/presentation-common

- `UnitSystemFormat`, `FormatsMap` and `KoqPropertyValueFormatter` constructor using the latter type have been deprecated. Instead, the constructor overload with "props" object should be used. The props object allows passing an optional `FormatsProvider` to use for finding formatting props for different types of values. When not specified, the `SchemaFormatsProvider` is used by default, so the behavior stays the same as before. Ideally, it's expected that frontend apps will pass `IModelApp.formatsProvider` for this prop.

### @itwin/presentation-backend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelDb]($core-backend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.
- The `PresentationManagerProps.defaultFormats` property has been deprecated in favor of the new `formatsProvider` property.

### @itwin/presentation-frontend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelConnection]($core-frontend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.
- The `PresentationManagerProps.defaultFormats` property has been deprecated in favor of the `FormatsProvider` now being available on [IModelApp.formatsProvider]($core-frontend).

## Geometry

### @itwin/geometry

- A new geometry subsystem for 2D analytic computation of lines and circles with tangency and radius restrains.
- If given a combination of lines and circles, the (complete set of) circles tangent to them may be obtained by calling specific methods in ConstrainedConstruction, e.g.
  - TangentConstruction.circlesTangentCCC (circleA, circleB, circleC) -- returns up to 8 tangent circles
  - TangentConstruction.circlesTangentLLL (lineA, lineB, lineC)
  - TangentConstruction.circlesTangentLLC (lineA, lineB, circleC)
  - TangentConstruction.circlesTangentCCL (circleA, circleB, lineC)
  - TangentConstruction.linesTangentCC, linesPerpLPerpC, linesPerpCPerpC -- lines tangent or perpendicular to lines and circles
  - TangentConstruction.circlesTangentCCR, circlesTangentLLR, circlesTangentCLR -- circles with given radius an d tangent to given lines and circles.

This code makes two circles and a line and constructs the tangent circles:
'''
    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, 2);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(3, 5, 2);
    const line = UnboundedLine2dByPointAndNormal.createPointXYPointXY(-1, 0, 5, 3);
    const circles = TangentConstruction.circlesTangentCCL(circleA, circleB, line);
'''

![CircleCircleLine Tangency Example](./assets/circlesTangentCCL_SampleA.jpg "Example of circles tangent to 2 circles and a line.  For this case there are 4 tangent circles (green).")

This code constructs a circleC which intersects both the line and circleA, so there are 8 tangent circles.
'''
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(3, 5, 6);
    const circlesAC = TangentConstruction.circlesTangentCCL(circleA, circleC, line);
'''

![CircleCircleLine Tangency Example](./assets/circlesTangentCCL_SampleB.jpg "Example of circles tangent to 2 circles and a line.  For this case there are 8 tangent circles (green).")

The (new) CurveFactory class has new static methods for converting full 3D  curves to (new) specialized 2D classes for the tangency constructions.
  - CurveFactory.createImplicitCurve2dFromCurvePrimitiveXY (curve3d)
    - returns a specialized UnboundedLine2d, UnboundedCircle2d, unboundedEllipse2d for the XY part of the given CurvePrimitive
  - CurveFactory.createCurvePrimitiveFromImplicitCurve (curvePrimitive)
    - returns a CurvePrimitive for the given implicit curve.

A new class ConstraintSet is an array of constraints (tangent, radius, or perpendicular) it has methods to examine the array and select an appropriate circle or line tangency method (from TangentConstruction listed above).
  - ConstraintSet.constructConstrainedCircles (array of constraint descriptors) -- selects an appropriate TangencyConstruction for (unordered) combination of circles, lines and radius constraints.
- ConstraintSet.constructConstrainedLines (array of constraint descriptors) -- selects an appropriate TangencyConstruction for (unordered) combination of circles and lines.
- The 2D geometry base class ImplicitGeometry2d which are:
  - strictly 2D curves
    - UnboundedCircle2dByCenterAndRadius
      - complete circle defined by (only) center and radius
      - (zero radius circle is a point)
    - UnboundedLine2dByPointAndNormal
      - line in 2d, with no preferred endpoints
    - and lesser known types for future use
      - UnboundedEllipse2d
        - ellipse defined by two vectors of a local coordinate system which skews and scales the unit circle
        - complete ellipse, without angle bounds
      - UnboundedHyperbola2d
        - hyperbola placed by two vectors which skew and scale uv hyperbola u^2-v^2=1
      - UnboundedParabola2d
        - parabola placed by two vectors which skew and scale the uv parabola y=x^2
- Additional construction methods for "medial axis" between pairs of circles and lines:
  - TangencyConstruction.medialCurveCircleCircle -- returns hyperbolas equidistant from 2 circles
  - TangencyConstruction.medialCurveLineCircle -- returns parabola equidistant from line and circle.

