---
ignore: true
---
# NextVersion

## High-DPI display support

The renderer now takes into account the [device pixel ratio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio) ("DPI") of the display by adjusting [Viewport]($frontend) resolution to match screen resolution, including any scaling applied by the operating system or browser. This corrects issues like blurriness on high-DPI retina displays. This behavior is enabled by default; to disable it, set [RenderSystem.Options.dpiAwareViewports]($frontend) to `false` when initializing the [IModelApp]($frontend).

All APIs continue to specify pixel-valued *inputs* as CSS pixels. However, APIs that read and **return** pixel values now do so in **device** pixels. The following new APIs can help when dealing with this discrepancy:
* [queryDevicePixelRatio]($frontend) to obtain the device pixel ratio; and
* [cssPixelsToDevicePixels]($frontend) to convert from CSS pixels to device pixels.

The primary affected API is [Viewport.readPixels]($frontend). Below is an example of how to correctly account for DPI scale when using that function:

```ts
/** Returns true if the specified element was drawn inside the specified region of the viewport. */
function isElementDrawnInRect(vp: Viewport, rect: ViewRect, elementId: Id64String): boolean {
  let elementFound = false;
  vp.readPixels(rect, Pixel.Selector.Feature, (pixels) => {
  if (undefined === pixels)
    return;

  // Input rect is specified in CSS pixels - convert to device pixels.
  const deviceRect = new ViewRect(cssPixelsToDevicePixels(rect.left), cssPixelsToDevicePixels(rect.top),
    cssPixelsToDevicePixels(rect.right), cssPixelsToDevicePixels(rect.bottom));

  for (let x = deviceRect.left; x < deviceRect.right; x++) {
    for (let y = deviceRect.top; y < deviceRect.bottom; y++) {
    const pixel = pixels.getPixel(x, y);
    if (undefined !== pixel.feature && pixel.feature.elementId === elementId) {
      elementFound = true;
      return;
    }
  });

  return elementFound;
}
```

## Geometry

### Miscellaneous

* static `AngleSweep.isRadiansInStartEnd(radians: number, radians0: number, radians1: number, allowPeriodShift?: boolean): boolean;`
  * new parameter (default false) to request considering period shifts.
* static `NumberArray.createArrayWithMaxStepSize(low: number, high: number, step: number): number[];`
  * new method, returns array of numbers with (max) step size between low and high
* New `Plane3dByOriginAndVectors` instance method `myPlane.normalizeInPlace (): boolean` to normalize the vectors.
  * apply `Vector3d` instance method `normalizeInPlace()` to both `vectorU` and `vectorV` of the plane
* New `Range3d` instance method `myRange.extendSingleAxis(a: number, axisIndex: AxisIndex): void;`
  * branch to one of `extendXOnly`, `extendYOnly`, `extendZOnly`
* New `Ray3d` instance method to multiply by inverse of a transform and return the modified ray: `myRay.cloneInverseTransformed(transform: Transform): Ray3d | undefined;`
