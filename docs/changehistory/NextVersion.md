---
ignore: true
---
# NextVersion

## Geoemtry
### `CurveCurve.intersectionPairsXY` returns details of line-line and arc-arc coincident geometry
  * `CurveLocationDetail` data carrier has new optional members
     * `fraction1` = fractional position for end of coincident section
     * `point` = point at end of coincident section
     * `detail.captureFraction1Point1 (f,xyz)` directly captures (no clone) fraction and point.
     * CurveLocationDetail.createCurveEvaluatedFractionFraction` constructor with 2 fractions.
     * `detail.inverseInterpolateFraction (f, defaultLocalFraction)` maps input fraction f to local fraction of the `fraction, fraction1` interval of the detail.
     * `detail.swapFractionsAndPoints ()` swaps the `[fraction,point]` and `[fraction1, point1]` values (if both defined)



### Miscellaneous
  * New `Ard3d` method `arc.scaleAboutCenterInPlace (scaleFactor);`
  * New `Matrix3d` method `matrixA.multiplyMatrixInverseMatrix(other: Matrix3d, result?: Matrix3d): Matrix3d | undefined`
  * New `Segment1d` method `segment.clampDirectedTo01(): boolean;`
    * intersect with [0,1] interval
    * maintain current direction
    * return false if empty after clip.
  * New `Segment1d` method `segment.`reverseIfNeededForDeltaSign(sign?: number): void;`
    * maintain endpoints, but reverse so direction corresponds to request.