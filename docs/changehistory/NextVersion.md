---
ignore: true
---
# NextVersion

## Thematic display

Thematic display supports several new gradient mode values for the `mode` property of [ThematicGradientSettings]($common):
* `ThematicGradientMode.Stepped` applies a stepped color gradient to the scene.
* `ThematicGradientMode.SteppedWithDelimiter` applies a stepped color gradient to the scene with delimiters (lines between the color steps).
* `ThematicGradientMode.IsoLines` applies isolines to the scene to achieve an effect similar to a contour map.

Note: Gradient modes `ThematicGradientMode.SteppedWithDelimiter` and `ThematicGradientMode.IsoLines` cannot be used with a thematic display mode value of `ThematicDisplayMode.InverseDistanceWeightedSensors`.

![stepped thematic gradient mode applied to height](./assets/thematic_stepped.png)
<p align="center">Stepped thematic gradient mode applied to height</p>

![stepped-with-delimiter thematic gradient mode applied to height](./assets/thematic_steppedWithDelimiter.png)
<p align="center">Stepped-with-delimiter thematic gradient mode applied to height</p>

![isoline thematic gradient mode applied to height](./assets/thematic_isolines.png)
<p align="center">Isoline thematic gradient mode applied to height</p>
