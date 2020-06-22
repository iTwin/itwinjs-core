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

## Hyper-modeling

The hyper-modeling [Extension]($frontend) has been replaced by the `hypermodeling-frontend` package to permit customization of its behavior. See [HyperModeling]($hypermodeling) and [SectionMarkerSetDecorator]($hypermodeling). Consult the package's README for further details.

## ECSql Enhancements

Added these expressions and functions

1. `<type> IS [NOT] (type-list)` - Filter parent type by subtype
    * [Lesson 9: Type Filter](../learning/ECSQLTutorial/TypeFilter.md)
1. `CASE-WHEN-THEN-ELSE` - Conditional expression
    * [Lesson 10: Conditional Expressions](../learning/ECSQLTutorial/ConditionalExpr.md)
1. `IIF()`  - Conditional expression
    * [Lesson 10: Conditional Expressions](../learning/ECSQLTutorial/ConditionalExpr.md)
1. `ec_classname()` - Get formatted class names for a ECClassId
    * [Lesson 11: Built-In functions](../learning/ECSQLTutorial/BuiltInFunctions.md)
1. `ec_classid())` - Get ECClassId from a  qualified classname.
    * [Lesson 11: Built-In functions](../learning/ECSQLTutorial/BuiltInFunctions.md)
