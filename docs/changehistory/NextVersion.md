---
ignore: true
---
# NextVersion

## Geometry

* Summary:
  * in/on/out test for x,y point in loop, parity region, or union region.

* `BilinearPatch` methods
  * Method to compute points of intersection with a ray:
    * intersectRay(ray: Ray3d): CurveAndSurfaceLocationDetail[] | undefined;
* `NumberArray` methods
  * In existing static method `NumberArray.maxAbsDiff`, allow both `number[]` and `Float64Array`, viz
    * (static) `NumberArray.maxAbsDiff(dataA: number[] | Float64Array, dataB: number[] | Float64Array): number;`
* `Plane3dByOriginAndUnitNormal` methods
  * (static) `static createXYAngle(x: number, y: number, normalAngleFromX: Angle, result?: Plane3dByOriginAndUnitNormal): Plane3dByOriginAndUnitNormal;`
