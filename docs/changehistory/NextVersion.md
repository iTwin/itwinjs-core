---
ignore: true
---
# NextVersion

## View transition animations

iModel.js will now perform smooth animations when changing between saved views, if possible. If the beginning and ending views are in the same direction but far apart, a *zoom out then in* path is followed to provide context. See [ScreenViewport.animation]($frontend) for settings that control view animations.

## IModel Transformation and Data Exchange

[IModelExporter]($backend), [IModelTransformer]($backend), and [IModelImporter]($backend) are now beta and provide low-level functionality needed for iModel transformation and data exchange.
See the [iModel Transformation and Data Exchange]($docs/learning/backend/IModelTransformation.md) article for more information.

## High-DPI display support

Beta support for [device pixel ratio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio) was introduced in v1.9.0. 1.10.0 fixes a handful of bugs associated with this feature. In particular, device pixel ratio may vary between different [Viewport]($frontend)s. As a result, the previously free-standing APIs have moved to the [Viewport]($frontend) class:

* [Viewport.devicePixelRatio]($frontend) replaces `queryDevicePixelRatio`.
* [Viewport.cssPixelsToDevicePixels]($frontend) replaces `cssPixelsToDevicePixels`.

Do not assume that `Viewport.devicePixelRatio` will always return [`window.devicePixelRatio`](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio).

## Geometry

### Matrix3d inverse state bug fix

* BUG: matrix times matrix multipliers (multiplyMatrixMatrix, multiplyMatrixMatrixInverse, multiplyMatrixInverseMatrix, multiplyMatrixMatrixTranspose, multiplyMatrixTransposeMatrix) did not transfer inverse coefficient arrays into the product.
* When an existing result matrix marked "inverseStored" was supplied, the "inverseStored" marking persisted, but the product inverse coefficient matrix was not constructed
* When no result was supplied in the call, there were no problems.
* As corrected, all 5 multiplications construct inverse products when possible, and mark up appropriately.

### `CurveCurve.intersectionPairsXY` returns details of line-line and arc-arc coincident geometry

* `CurveLocationDetail` data carrier has new optional members
  * `fraction1` = fractional position for end of coincident section
  * `point` = point at end of coincident section
  * `detail.captureFraction1Point1 (f,xyz)` directly captures (no clone) fraction and point.
  * CurveLocationDetail.createCurveEvaluatedFractionFraction` constructor with 2 fractions.
  * `detail.inverseInterpolateFraction (f, defaultLocalFraction)` maps input fraction f to local fraction of the `fraction, fraction1` interval of the detail.
  * `detail.swapFractionsAndPoints ()` swaps the `[fraction,point]` and `[fraction1, point1]` values (if both defined)

### Viewing tools

* New walk tool 'LookAndMoveTool'
  * Supports mouse look and keyboard (wasd) for movement.
  * Touch screen control sticks for look and move.

### Miscellaneous

* New `Arc3d` method `arc.scaleAboutCenterInPlace (scaleFactor);`
* New `Matrix3d` method `matrixA.multiplyMatrixInverseMatrix(other: Matrix3d, result?: Matrix3d): Matrix3d | undefined`
* New `Segment1d` method `segment.clampDirectedTo01(): boolean;`
  * intersect with [0,1] interval
  * maintain current direction
    * return false if empty after clip.
  * New `Segment1d` method `segment.`reverseIfNeededForDeltaSign(sign?: number): void;`
    * maintain endpoints, but reverse so direction corresponds to request.
