# Point and Vector operations

# Notes on compact table notation
* Many arguments which might be strongly typed as `Point3d`, `Vector3d`, `Point3d`, `Vector3d` are weakly typed as `XYandZ` or `XandY`.
  * These allow any object that has `x` and `y ` properties to be passed as inputs.
* Many methods have optional result args.
  * The optional arg is NOT indicated here.
  * If the caller supplies the optional arg, that preexisting object will be reinitialized.
  * If a method is being called many times in a loop, reusing a result can give a significant performance benefit.

Typical names in the tables are:
| name | implied type | remarks |
|---|---|---|
| x | number | x coordinate |
| y | number | y coordinate |
| z | number | z coordinate |
| p | Point3d or Point2d | point object |
| v | Vector3d or Vector2d | vector object |
| newVector | Vector3d or Vector2d | newly created vector object |
| basePoint | Point3d or Point2d | point object used as origin of the calculation |
| targetA, targetB | Point3d, Vector3d, Point2d, or Vector3d | point or vector used as target of a vector during the calculation |

## public members

| category | Point3d | Vector3d | Point2d | Vector2d |
|---|---|---|---|---|
| components  | x: number; | x: number; | x: number; | x: number; |
|             | y: number; | y: number; | y: number;| y: number; |
|             | z: number; | z: number; | | |

## static "create" methods

| category | Point3d | Vector3d | Point2d | Vector2d |
|---|---|---|---|---|
| create by coordinates | p = Point3d.create (x,y,z) | v = Vector3d.create (x,y,z) | p = Point2d.create (x,y) | v = Vector2d.create (x,y) |
| vectors in principal axis directions, default length 1 | | v = Vector3d.unitX (length:number = 1) | | v = Vector3d.unitX (length:number = 1) |
| | | v = Vector3d.unitY (length:number = 1) | | v = Vector3d.unitY (length:number = 1)  |
| | | v = Vector3d.unitZ (length:number = 1) | | |
| create all zeros | p = Point3d.createZero () | v = Vector3d.createZero () | p = Point2d.createZero () | v = Vector2d.createZero () |
| create from variant sources| `Point3d.createFrom (other: Float64Array | XAndY | XAndYAndZ)`| `Vector3d.createFrom (other: Float64Array | XAndY | XAndYAndZ)`| `Point2d.createFrom (other: XAndY)`| `Vector2d.createFrom (other: XAndY | Float64Array)`|
| create from index in packed xyzxyz..  | p = Point3d.createFromPacked (Float64Array, pointIndex) | | | |
| unweight from indexed in packed xyzwxyzw.. |p = Point3d.createFromPackedXYZW (Float64Array, pointIndex) | | | |
| create scaled copy | p = Point3d.createScale (pointA: XYAndZ, scalefactor) | | | |
| create sum of 2 weighted | p = Point3d.createAdd2Scaled (pointA: XYZAndZ, scaleA, pointB: XYAndZ: pointB, scaleB) | v = Vector3d.createAdd2Scaled (pointA: XYZAndZ, scaleA, pointB: XYAndZ: pointB, scaleB)| | |
| create sum of 2 weighted | | v = Vector3d.createAdd2ScaledXYZ (ax, ay, az, scaleA, bx, by, bz, scaleB)| | |
| create sum of 3 weighted | p = Point3d.createAdd3Scaled (pointA: XYZAndZ, scaleA, pointB: XYAndZ: pointB, scaleB, XYAndZ: pointC, scaleC) |v = Vector3d.createAdd3Scaled (pointA: XYZAndZ, scaleA, pointB: XYAndZ: pointB, scaleB, XYAndZ: pointC, scaleC) | | |
| Create from polar radius, angle, and z | | p = Point3d.createPolar (radius, angle, z) | p = Point2d.createPolar (radius, angle)| |
| Create from spherical radius, xy angle, elevation angle | | p = Pointd.createSpherical (radius, xyAngle, elevationAngle) | | |



## "create" via instance methods on existing objects

| category | Point3d | Vector3d | Point2d | Vector2d |
|---|---|---|---|---|
| vector from start to end | newVector = point.vectorTo (otherXYAndZ)  | newVector = vector.vectorTo(otherXYandZ) | newVector = point.vectorTo (otherXAndY) | newVector = vector.vectorTo (otherXAndY) |
| | | vector = Vector3d.createStartEnd (pointA, pointB) | | vector = Vector2d.createStartEnd (pointA, pointB)|
| | | vector = Vector3d.createStartEndXYZXYZ (ax, ay, az, bx, by, bz) | | |
| vector from start to end | newVector = vector.vectorTo(otherXYandZ)  | newVector = point.vectorTo (otherXYAndZ) | newVector = vector.vectorTo (otherXAndY)| newVector = point.vectorTo (otherXAndY) |
| clone as same type | newPoint = p.clone () | newVector = v.clone () |newPoint = p.clone () | newVector = v.clone () |
| unit vector from start to end | newVector = point.unitVectorTo (otherXYAndZ) | newVector = point.unitVectorTo (otherXYAndZ) | newVector = point.unitVectorTo (otherXYAndZ) | newVector = point.unitVectorTo (otherXAndY) |
| vector of specified length from start to end | newVector = point.scaledVectorTo (otherXYAndZ, length) | newVector = vector.scaledVectorTo (otherXYAndZ, length) |  | |
| clone as strongly type Point3d | p.cloneAsPoint3d () | v.cloneAsPoint3d () | | |
| vector rotated around axis vector | | newVector = Vector3d.createRotateVectorAroundVector (oldVector, axisVector, angle) | | |
| divide x,y,z of existing vector by scalar | | newVector = oldVector.saveDivideOrNull (denominator) | | newVector = oldVector.safeDivideOrNull (denominator) |
| return normalized vector, packaged in an object with length property | | newVector = oldVector.normalizeWithLength (): {v: vector3d, mag: number} | | |
| return scaled copy of instance | | newVector = oldVector.scale (scaleFactor) | | newVector = oldVector.scale (scaleFactor) |
| return copy scaled to specific length | | newVector = oldVector.scaleToLength (newLength) | | newVector = oldVector.scaleToLength (newLength)|
| return normalized vector | | `newVector = oldVector.normalize () : Vector3d | undefined` | |`newVector = oldVector.normalize () : Vector2d | undefined` |
| attempt to normalize in place.  If near zero length, leave unchanged and return `false` | | vector.normalizeInPlace () : boolean | | |
| clone negated | | newVector = oldVector.negate () | | newVector = oldVector.negate ()|
| vector rotated 90 degrees COUNERCLOCKWISE in XY plane, preserving z | | newVector = oldVector.rotate99CCWXY () | | newVector = oldVector.rotate99CCWXY ()|
| vector rotated 90 degrees CLOCKWISE in XY plane, preserving z | | | | newVector = oldVector.rotate99CWXY ()|
| vector rotated by angle in XY plane, preserving z | | newVector = oldVector.rotateXY () | |newVector = oldVector.rotateXY () |
| unit vector rotated 90 degrees in xy plane | | newVector = oldVector.unitPerpendicularXY () | |newVector = oldVector.unitPerpendicularXY () |
| vector rotated 90 degrees towards a target vector.  Rotation is in the plane containing both inputs. | | newVector = oldVector.rotate90Towards () | | |
| vector rotated 90 degrees around an axis vector. | | newVector = oldVector.rotate90Around () | | |
| vector to the intersection of offsets | | | | `vector = Vector2d.createOffsetBisector (unitPerpendicularA, unitPerpendicularB, offsetDistance) :Vector2d | undefined` |


## create by Interpolation and addition

| category | Point3d | Vector3d | Point2d | Vector2d |
|---|---|---|---|---|
| interpolate a point between instance and target  | newPoint = p.interpolate (fraction, target) | newVector = v.interpolate (fraction, target)| newPoint = basePoint.interpolate (fraction, target)|newVector = v.interpolate (fraction, target) |
| ray with origin interpolated between points, vector from point to point  | newPoint = basePoint.interpolatePointAndTangent (fraction, target) | | | |
| interpolate a point with distinct fractions for each x,y,z direction  | newPoint = basePoint.interpolateXYZ (fractionX, fractionY, fractionZ, target) | |newPoint = basePoint.interpolateXY (fractionX, fractionY, target)  | |
| fractional interpolate, then move perpendicular by a fraction of the XY rotation of the same vector| newPoint = p.interpolatePerpendicularXY (fraction, target, perpendicularFraction) | | | |
| from instance point, move a forwardFraction of vector, and perpendicularFraction of vector rotated 90 CCW | | | newPoint = oldPoint.addForwardAndLeft (forwardFraction, leftFraction, vector) | |
| from instance point, move a forwardFraction of towards target, and perpendicularFraction of vector rotated 90 CCW | | | newPoint = oldPoint.addForwardAndLeft (forwardFraction, leftFraction, targetPoint) | |
| new point/vector by adding a vector | newPoint = basePoint.plus (vector: XYAndZ) | newVector = v.plus (vector: XYAndZ)|newPoint = basePoint.plus (vector: XAndY) | newVector = v.plus (vector: XAndY)|
| new point by adding x,y,z args | newPoint = basePoint.plusXYZ (x,y,z) | |newPoint = basePoint.plusXY (x,y) | |
| new point/vector by subtracting a vector | newPoint = basePoint.minus (vector: XYAndZ) | newVector = v.minus (vector: XYAndZ) |newPoint = basePoint.minus (vector: XAndY) | newVector = v.minus (vector: XAndY) |
| new point/vector by adding scaled vector(s) | newPoint = basePoint.plusScaled (vector: XYAndZ, scale) |newVector = v.plusScaled (vector: XYAndZ, scale) |newPoint = basePoint.plusScaled (vector: XAndY, scale) | newVector = baseVector.plusScaled (vector: XAndY, scale)|
|  | newPoint = basePoint.plus2Scaled (vector: XYAndZ, scale1, vector2: XYAndZ, scale2) | newVector = baseVector.plus2Scaled (vector: XYAndZ, scale1, vector2: XYAndZ, scale2)|newPoint = basePoint.plus2Scaled (vector: XAndY, scale1, vector2: XAndY, scale2) | newVector = baseVector.plus2Scaled (vector: XAndY, scale1, vector2: XAndY, scale2)|
|  | newPoint = basePoint.plus3Scaled (vector: XYAndZ, scale1, vector2: XYAndZ, scale2, vector3: XYAndZ, scale3) | newVector = v.plus3Scaled (vector: XYAndZ, scale1, vector2: XYAndZ, scale2, vector3: XYAndZ, scale3)| newPoint = basePoint.plus3Scaled (vector: XAndY, scale1, vector2: XAndY, scale2, vector3: XAndY, scale3) |newVector = baseVector.plus3Scaled (vector: XAndY, scale1, vector2: XAndY, scale2, vector3: XAndY, scale3)|

## Dot, Cross and triple products

| category | Point3d | Vector3d | Point2d | Vector2d |
|---|---|---|---|---|
| dot product of two vectors |  | value = vectorA.dotProduct (vectorB) : number | | value = vectorA.dotProduct (vectorB) : number|
| dot product of XY parts of two vectors |  | value = vectorA.dotProductXY (vectorB) : number | | |
| dot product with vector given as x,y,z | | value = vectorA.dotProductXYZ (x,y,z) : number | | | 
| cross product of two vectors |  | newVector = Vector3d.createCrossProduct (vectorA, vectorB) : Vector3d| | |
|                              |  | value = vectorA.crossProduct (vectorB):number | | |
| cross product of XY parts of two vectors |  | value = vectorA.crossProductXY (vectorB) : number | | |
| normalized cross product (or undefined if vectorA and vectorB are parallel) | | `newVector = vectorA.unitCrossProduct (vectorB) : Vector3d | undefined` | | |
| cross product scaled to given length (undefined if vectorA and vectorB are parallel) | | `newVector = vectorA.sizedCrossProduct (vectorB, length) : Vector3d | undefined` | | |
| normalized cross product (or use x,y,z for default if vectorA and vectorB are parallel) | | `newVector = vectorA.unitCrossProductWithDefault (vectorB, x, y, z) : Vector3d` | | |
| cross product of two vectors | newVector = p.crossProductToPoints (targetA, targetB) : Vector3d | newVector = Vector3d.createCrossProductToPoints (basePoint, targetA, targetB ) |value = basePoint.crossProductToPoints (targetA, targetB) : number | |
| cross product with vector between input points | | value = vectorA.crossProductStartEnd (startPoint, endPoint) : Vector3d | | |
| cross product with vector between input points, using only xy parts | | value = vectorA.crossProductStartEndXY (startPoint, endPoint) : Vector3d | | |
| cross product of vectors from instance point to 2 targets | value = p.crossProductToPointsXY (targetA, targetB) |  | | |
| (scalar) triple product of three vectors  | value = p.tripleProductToPoints () : number| | | |
| (scalar) triple product of three vectors  | | value = vectorA.tripleProduct (vectorB, vectorC) : number| | |
| project instance onto a line segment, return fractional postition | fraction = spacePoint.fractionOfProjectionToLine (pointA, pointB) : number | fraction = spaceVector.fractionOfProjectionToVector(targetVector) : number | fraction = spacePoint.fractionOfProjectionToLine (pointA, pointB) : number|fraction = spaceVector.fractionOfProjectionToVector(targetVector) : number |
| in the instance, accumulate crossproduct of vectors from (baseX. baseY, baseZ) to (ax, ay, az) and (bx, by, bz) | | vector.addCrossProductToTargetsInPlace (baseX, baseY, baseZ, ax, ay, az, bx, by, bz) | |
| dot product of vectors from instance to 2 targets | a = basePoint.dotVectorsToTargets (pointA, pointB) | |a = basePoint.dotVectorsToTargets (pointA, 
pointB) | |
| dot product of instance vector with vector from startPoint to endPoint.  | | a = vector.dotProductStartEnd (startPoint, endPoint)  : number| | a = vector.dotProductStartEnd (startPoint, endPoint)  : number |

| dot product of instance vector with vector from startPoint to endPoint.  endPoint given as x,y,z,w to be unweighted. returns zero if weighth is zero.| | a = vector.dotProductStartEndXYZW (startPoint, x,y,x,z)  : number| | | |
| squared magnitude of cross product | | value = vectorA.crossProductMagnitudeSquared (vectorB) | | |
| magnitude of cross product | | value = vectorA.crossProductMagnitude (vectorB) | | |

## Angles between vectors

* Methods that return bare radians have *radians* in the method name.
* Methods without specific *radians* indication return a (strongly typed) `Angle` object that can be queried for `degrees` or `radians`.   

| category | Point3d | Vector3d | Point2d | Vector2d |
|---|---|---|---|---|
| angle between vectors, 3D is "in their plane" and unsigned.  2D is in XY plane and signed |  | angle = vectorA.angleTo (vectorB) : Angle | |angle = vectorA.angleTo (vectorB) : Angle |
| angle between vectors, in their plane but using outOfPlaneVector to define top and bottom. `outOfPlane` is *not* necessarily a perpendicular. |  | angle = vectorA.signedAngleTo (vectorB, outOfPlaneVector) : Angle | | |
| radians between vectors, in their plane but using outOfPlaneVector to define top and bottom. `outOfPlane` is *not* necessarily a perpendicular. |  | angle = vectorA.signedRadiansTo (vectorB, outOfPlaneVector) : number | | |
| angle between vectors, as viewed in xy plane |  | angle = vectorA.angleToXY (vectorB) : Angle  | | |
| angle between vectors, as viewed in plane perpendicular to planeNormal |  | angle = vectorA.planrRadiansTo (vectorB, planeNormal) : number  | | |
|      |  | angle = vectorA.planrAngleTo (vectorB, planeNormal) : Angle  | | |
| parallel vector test | | vectorA.isParallelTo (vectorB, oppositeIsParallel : boolean = false, returValueIfAnInputIsZero : boolean = false) | |vectorA.isParallelTo (vectorB, oppositeIsParallel : boolean = false) |
| perpendicular vector test | | vectorA.isPerpendicularTo (vectorB, returValueIfAnInputIsZero : boolean = false) | | vectorA.isPerpendicularTo (vectorB) |

## in-place updates (instance methods)

| category | Point3d | Vector3d | Point2d | Vector2d |
|---|---|---|---|---|
| set coordinates from number args | p.set (x,y,z) | v.set(x,y,z) | p.set(x,y) | v.set (x,y) |
| set coordinates to zero | p.setZero () | v.setZero () | p.setZero | v.setZero () |
| set coordinates as vector between inputs | | v.setStartEnd (basePoint, targetPoint) | | | |
| set coordinates from other objects| `p.setFrom (other: Float64Array | XAndY | XAndYAndZ)` | `v.setFrom (other: Float64Array | XAndY | XAndYAndZ)` | p.setFrom (other?: XAndY) | v.setFrom (other?: XAndY) |
| scale coordinates | p.scaleInPlace (scaleFactor) | v.scaleInPlace (scaleFactor) | | |

## unary queries (instance methods)
| category | Point3d | Vector3d | Point2d | Vector2d |
|---|---|---|---|---|
| metric zero test on all components| p.isAlmostZero () | v.isAlmostZero () | p.isAlmostZero () | v.isAlmostZero () |
| largest absolute component (number)| p.maxAbs () | v.maxAbs () | p.maxAbs () | v.maxAbs () |
| magnitude |  p.magnitude () | v.magnitude () | p.magnitude () | v.magnitude () |
| magnitude squared | p.magnitudeSquared () | v.magnitudeSquared () | p.magnitudeSquared () | v.magnitudeSquared () |
| magnitude ignoring z |  p.magnitudeXY () | v.magnitudeXY () | | |
| magnitude squared ignoring z | p.magnitudeSquaredXY () | v.magnitudeSquaredXY () | | |

## property verification

These are static methods on the XYZ class.  Hence they are inherited by Point3d and Vector3d. Their inputs are raw objects which may have x,y,z as properties but are not full-fledged Point3d, Vector3d, Point2d, Vector2d objects.

|condition | method |
|---|---|
| has x and y properties (z not tested) | XYZ.isXAndY (anyObject) |
| has z propertiy  | XYZ.hasZ (anyObject) |
| has x, y and z properties (z not tested) | XYZ.isXYAndZ (anyObject) |


##  binary queries(instance methods)

(methods that take the "other" point or vector as direct numbers in the call list are considered "binary" for this table.)
| category | Point3d | Vector3d | Point2d | Vector2d |
|---|---|---|---|---|
| near equality with metric tolerance | p.isExactEqual (otherXYAndZ) | v.isExactEqual (otherXYAndZ) | p.isExactEqual (otherXAndY) | v.isExactEqual (otherXAndY) |
| near equality with metric tolerance, unrolled xyz inputs | p.isAlmostEqualXYZ (x,y,z) | v.isAlmostEqual (x,y,z) |  | |
| near equality with metric tolerance, unrolled xy inputs | p.isAlmostEqualXYZ (x,y) | v.isAlmostEqual (x,y) |  | |
| exact equality | p.isAlmostEqual (otherXYAndZ) | v.isAlmostEqual (otherXYAndZ) | p.isAlmostEqual (otherXAndY) | v.isAlmostEqual (otherXAndY) |
| distance between | p.distance (otherXYAndZ) | v.distance (otherXYAndZ) | p.distance (otherXAndY) | v.distance (otherXAndY) |
| squared distance between | p.distanceSquared (otherXYAndZ) | v.distanceSquared (otherXYAndZ) | p.distanceSquared (otherXAndY) | v.distanceSquared (otherXAndY) |
| distance between, ignore z | p.distanceXY (otherXYAndZ) | v.distanceXY (otherXYAndZ) |
| squared distance between, ignore z | p.distanceSquaredXY (otherXYAndZ) | v.distanceSquaredXY (otherXYAndZ) |
| max component difference | p.maxDiff (otherXYAndZ) | v.maxDiff (otherXYAndZ) | p.maxDiff (otherXAndY) | v.maxDiff (otherXAndY) |

