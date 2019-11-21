---
ignore: true
---
# NextVersion

## Geometry

# Miscellaneous

* static `AngleSweep.isRadiansInStartEnd(radians: number, radians0: number, radians1: number, allowPeriodShift?: boolean): boolean;`
  * new parameter (default false) to request considering period shifts.
* static `NumberArray.createArrayWithMaxStepSize(low: number, high: number, step: number): number[];`
  * new method, returns array of numbers with (max) step size between low and high
* New `Plane3dByOriginAndVectors` instance method `myPlane.normalizeInPlace (): boolean` to normalize the vectors.
  * apply `Vector3d` instance method `normalizeInPlace()` to both `vectorU` and `vectorV` of the plane
* New `Range3d` instance method `myRange.extendSingleAxis(a: number, axisIndex: AxisIndex): void;`
  * branch to one of `extendXOnly`, `extendYOnly`, `extendZOnly`
* New `Ray3d` instance method to multiply by inverse of a transform and return the modified ray: `myRay.cloneInverseTransformed(transform: Transform): Ray3d | undefined;`


