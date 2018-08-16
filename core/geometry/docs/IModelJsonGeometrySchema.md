
## CurvePrimitive Types

| class name | remarks | example or hint |
|----|----|---|
| LineSegment3d | lineSegment on x axis | `{"lineSegment":[[0,0,0], [3,0,0]]}`|
| Arc3d | circular arc | `{"arc": {"center":[0,0,0],  "vectorX":[3,0,0],  "vectorY":[0,3,0],  "sweepStartEnd":[0,90] }}`|
| Arc3d | elliptic arc | `{"arc":{"center":[0,0,0],"vectorX":[5,0,0],"vectorY":[0,15,0],"sweepStartEnd":[-45,190]}}`|
| LineString3d | linestring | `{"lineString":[[0,0,0],[5,0,0],[5,5,0],[0,5,0]]}` |
| BSplineCurve | bcurve | `{"bcurve":{"points":[[0,0,0],[5,0,0],[5,5,0],[1,5,0]],"knots":[0,0,0,0,1,1,1,1],"closed":false,"order":4}}`|

## CurveCollection types

| class name | remarks | Minimal Example |
|----|----|---|
| Path | path | `{"path":[{"lineSegment":[[4,4,0],[4,0,0]]},{"arc":{"center":[0,0,0],"vectorX":[4,0,0],"vectorY":[0,4,0],"sweepStartEnd":[0,180]}},{"lineSegment":[[-4,0,0],[0,0,0]]}]}`|
| Loop | loop | `{"loop":[{"arc":{"center":[0,0,0],"vectorX":[5,0,0],"vectorY":[0,5,0],"sweepStartEnd":[0,180]}},{"lineSegment":[[-5,0,0],[5,0,0]]}]}`|

## SolidPrimitive types

| class name | remarks | Minimal Example |
|----|----|---|
| Box | box |`{"box": {"baseOrigin":[1,2,3],  "baseX":3,  "baseY":2,  "capped":true,  "topOrigin":[1,2,8] }}` |
| Sphere | sphere |`{"sphere": {"center":[0,0,0],  "radius":1 }}`|
| Cylinder | cylinder | `{"cylinder": {"capped":false,  "start":[1,2,1],  "end":[2,3,8],  "radius":0.5 }}`|
| Cone | cone |`{"cone": {"capped":true,  "start":[0,0,5],  "end":[0,0,0],  "startRadius":0,  "endRadius":1, "xyVectors":[[-1,0,0],  [0,1,0]] }}`|
| LinearSweep | linearSweep | `{"linearSweep": {"contour":  {"loop":[{"arc": {"center":[0,0,0], "vectorX":[5,0,0], "vectorY":[0,5,0], "sweepStartEnd":[0,180]}}, {"lineSegment":[[5,0,0], [-5,0,0]]}]}, "capped":true, "vector":[0.1,0.21,1.234]}}`|
| RotationalSweep | rotationalSweep | `{"rotationalSweep": {"axis":[0,1,0],  "contour":  {"loop":[{"lineString":[[1,0,0],[3,0,0], [3,3,0],[1,3,0]]   }]  },  "capped":false,  "center":[0,0,0],  "sweepAngle":120}}`|
| TorusPipe | torusPipe | `{"torusPipe": {"center":[0,0,0],  "majorRadius":5,  "minorRadius":0.8,  "xyVectors":[[1,0,0],  [0,1,0]] }}`|
| RuledSweep | ruledSweep | `{"ruledSweep": {"contour":[  {"loop":[   {"lineString":[[0,0,0],    [3,0,0],    [3,2,0],    [0,2,0],    [0,0,0]]   }]  },  {"loop":[   {"lineString":[[0,0,2],    [3,0,2],    [3,2.5,2],    [0,2.5,2],    [0,0,2]]   }]  }],  "capped":true }}`|
||||

## Isolated point

| class name | property name | Minimal Example |
|----|----|---|
| CoordinateXYZ | point |`{"point":[11,7,5]}`|

json.bagOfCurves
json.bcurve
json.bsurf
json.contour
json.indexedMesh
json.length
json.loop
json.parityRegion
json.path
json.pointString
json.transitionSpiral
json.unionRegion
json.xyVectors
json.yawPitchRollAngles
json.zxVectors

hasOwnProperty("bagOfCurves")
hasOwnProperty("bsurf")
hasOwnProperty("color")
hasOwnProperty("colorIndex")
hasOwnProperty("cone")
hasOwnProperty("cylinder")
hasOwnProperty("indexedMesh")
hasOwnProperty("linearSweep")
hasOwnProperty("loop")
hasOwnProperty("normal")
hasOwnProperty("normalIndex")
hasOwnProperty("orderU")
hasOwnProperty("orderV")
hasOwnProperty("param")
hasOwnProperty("paramIndex")
hasOwnProperty("parityRegion")
hasOwnProperty("path")
hasOwnProperty("point")
hasOwnProperty("pointIndex")
hasOwnProperty("points")
hasOwnProperty("pointString")
hasOwnProperty("rotationalSweep")
hasOwnProperty("ruledSweep")
hasOwnProperty("sphere")
hasOwnProperty("torusPipe")
hasOwnProperty("transitionSpiral")
hasOwnProperty("uKnots")
hasOwnProperty("unionRegion")
hasOwnProperty("vKnots")
