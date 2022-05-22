# Anti-aliasing

The [iTwin.js renderer](./index.md) supports [multi-sample anti-aliasing](https://en.wikipedia.org/wiki/Multisample_anti-aliasing) ("MSAA") to help smooth out jagged lines and polygon edges. The quality of the resultant image - and the potential reduction in framerate - increases with the number of samples requested. The number of samples is a power of two, up to the maximum supported by the graphics hardware. Most MSAA-enabled hardware supports up to 8 or 16 samples - so, values of 2, 4, 8, and 16 indicate discrete levels of anti-aliasing. Intermediate values are rounded down to the nearest power of two. A value of 1 or less indicates no anti-aliasing should be applied.

This feature can be enabled in one of two ways:

## Controlling anti-aliasing for a specific viewport

[Viewport.antialiasSamples]($frontend) gets or sets the number of MSAA samples for the viewport.

```ts
  viewport.antialiasSamples = 8; // Enable 8x MSAA
  viewport.antialiasSamples = 1; // Disable MSAA
```

## Controlling anti-aliasing for all viewports

[ViewManager.setAntialiasingAllViews]($frontend) sets the number of MSAA samples for all currently- and subsequently-opened [Viewport]($frontend)s.

```ts
  IModelApp.viewManager.setAntialiasingAllViews(8); // Enable 8x MSAA
  IModelApp.viewManager.setAntialiasingAllViews(1); // Disable MSAA
```

## Comparison images

No antialiasing on the left, vs 8x MSAA on the right. The effect is particularly noticeable around the windows and stairs:

![MSAA comparison - apartment](../../changehistory/assets/AntialiasExample1.png)

No antialiasing on the left, vs 8x MSAA on the right. The effect is particularly noticeable around the distant foliage:

![MSAA comparison - foliage](../../changehistory/assets/AntialiasExample2.png)
