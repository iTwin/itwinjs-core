
## CurvePrimitive

|constructor | remarks | json |
|----|----|---|
| LineSegment3d.create | Simple line segment | `{"lineSegment":[[0,0,0],[4,0,0]]}`|
| LineString3d.create | linestring by points | `{"lineString":[[0,0,0],[4,0,0],[4,4,0],[0,4,0]]}`|
| Arc3d.createCircularStartMiddleEnd | arc passing through 3 points | `{"arc":{"center":[2,2.000000000000001,0],"vectorX":[-2,-2.000000000000001,0],"vectorY":[2.000000000000001,-2,0],"sweepStartEnd":[0,179.99999999999997]}}`|
| Arc3d.create | circular arc | `{"arc":{"center":[0,0,0],"vectorX":[4,0,0],"vectorY":[0,4,0],"sweepStartEnd":[-45,90]}}`|
| Arc3d.create | elliptic arc | `{"arc":{"center":[0,0,0],"vectorX":[4,0,0],"vectorY":[0,12,0],"sweepStartEnd":[-45,190]}}`|
| BSplineCurve3d.create | curve by poles | `{"bcurve":{"points":[[0,0,0],[4,0,0],[4,4,0],[0,4,0]],"knots":[0,0,0,0,1,1,1,1],"closed":false,"order":4}}`|

## CurveCollections

|constructor | remarks | json |
|----|----|---|
| Path.create | path with line, arc, line | `{"path":[{"lineSegment":[[4,4,0],[4,0,0]]},{"arc":{"center":[0,0,0],"vectorX":[4,0,0],"vectorY":[0,4,0],"sweepStartEnd":[0,180]}},{"lineSegment":[[-4,4.898587196589413e-16,0],[0,0,0]]}]}`|
| Loop.create | loop with semicircle and diameter segment | `{"loop":[{"arc":{"center":[0,0,0],"vectorX":[4,0,0],"vectorY":[0,4,0],"sweepStartEnd":[0,180]}},{"lineSegment":[[-4,4.898587196589413e-16,0],[4,0,0]]}]}`|
| ParityRegion.create | rectangle with semicirular hole | `{"parityRegion":[{"loop":[{"lineString":[[-4.5,-4.5,0],[4.5,-4.5,0],[4.5,4.5,0],[-4.5,4.5,0],[-4.5,-4.5,0]]}]},{"loop":[{"arc":{"center":[0,0,0],"vectorX":[4,0,0],"vectorY":[0,4,0],"sweepStartEnd":[0,180]}},{"lineSegment":[[-4,4.898587196589413e-16,0],[4,0,0]]}]}]}`|

## SolidPrimitive types

|constructor | remarks | json |
|----|----|---|
| Sphere.createCenterRadius(center, radius) | full sphere | `{"sphere":{"center":[1,1,0],"radius":3}}`|
| Cone.createAxisPoints(centerA, centerB, radiusA, radiusB, capped) | full sphere | `{"cone":{"capped":true,"start":[-1,1,0],"end":[3,2,0],"startRadius":1.5,"endRadius":2,"xyVectors":[[-0.24253562503633297,0.9701425001453319,0],[0,0,1]]}}`|
| Box.createDgnBox(cornerA, xVector, yVector, baseX, baseY, topX, topY, capped) | box with sides slanting inward | `{"box":{"baseOrigin":[-1,1,0],"baseX":4,"baseY":3,"capped":true,"topOrigin":[-1,2,4],"topY":2}}`|
| TorusPipe.createInFrame(frame, majorRadius, minorRadius, sweep, capped) | 90 degree elbos | `{"torusPipe":{"center":[1,1,1],"majorRadius":3,"minorRadius":1,"xyVectors":[[0,1,0],[-0.8320502943378437,0,0.5547001962252291]],"sweepAngle":90,"capped":true}}`|
| LinearSweep.create(contour, sweepVector, capped) | swept hexagon | `{"linearSweep":{"contour":{"loop":[{"lineString":[[2,0,0],[1.5,0.8660254037844386,0],[0.5,0.8660254037844387,0],[0,0,0],[0.5,-0.8660254037844385,0],[1.5,-0.866025403784439,0],[2,0,0]]}]},"capped":true,"vector":[0,0,4]}}`|
| RotationalSweep.create(contour, axisOfRotation, sweepAngle, capped) | hexagon rotated | `{"rotationalSweep":{"axis":[0,1,0],"contour":{"loop":[{"lineString":[[2,0,0],[1.5,0.8660254037844386,0],[0.5,0.8660254037844387,0],[0,0,0],[0.5,-0.8660254037844385,0],[1.5,-0.866025403784439,0],[2,0,0]]}]},"capped":true,"center":[-1,0,0],"sweepAngle":135}}`|
||||

## Isolated point

| class name | property name | Minimal Example |
|----|----|---|
| CoordinateXYZ | isolated point | `{"point":[0,0,0]}`|
