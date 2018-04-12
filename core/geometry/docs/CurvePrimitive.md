
# Curve Primitives

A CurvePrimitive is a bounded continuous curve.

## lineSegment

* A line segment is a portion of an infinite line.
* Json Fragment: `[{"lineSegment":[[0,0,0], [3,0,0]]}`
* typescript object:
```
        const myLineSegmentr = LineSegment.create (Point3d.create (1,2,3), Point3d.create(6,4,2));
```

 * Fractional Parameterization:
```
    A = start point
    B = end point
    f = fraction varying from 0 to 1
    Point X(f) at fractional position f along the lineSegment is
        X(f) = (1-f) * A + f * B
```

## lineString
* Typescript object:
```
        const myLineString = LineString.create ([point0, point1, point2 ....]);
```
## arc

* An arc primitive is a portion of an ellipticla arc.
* Fractional Parameterization:
```
    C = center point
    U = vector from center point to 0-degere point
    V = vector from center point to 90-degree point.
    theta0 = angular start point
    theta1 = angular and point
    f = fraction varying from 0 to 1
    theta(f) = (1-f) * theta0 + f * theta1
        Point X(f) at fractional position f along the arc is

    X(f) = C + cos (theta(f)) * U + sin(theta(f)) * V
```
* Angles theta0 and theta1 can be negative.
* Anlge theta1 can be less than theta0
* In common usage, the U vector is the "major axis" and V is the "minor axis".
* In the major/minor usage, the mangitudes of U and V are the major and minor axis radii, and U and V are perpendicular.
* But the perpendicular condition is not required -- non-perpendicular vectors occur due to transformation and construction history.

### bcurve

### transitionSpiral
