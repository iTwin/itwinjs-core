---
ignore: true
---
# NextVersion

## Thematic Display of Point Clouds

Thematic display now supports point clouds. If thematic display is enabled, point clouds will be colorized using the corresponding thematic settings.

Note: Values of `ThematicDisplayMode.Slope` or `ThematicDisplayMode.HillShade` for the `displayMode` property of [ThematicDisplay]($common) do not affect point clouds. If these thematic display modes are selected, point clouds will be colorized normally without any of the thematic settings applied. In this case, surfaces in the scene will still be colorized using the thematic settings.

![thematic rendering applied to a point cloud](./assets/thematic_pointclouds.png)
<p align="center">Thematic rendering applied to a point cloud</p>

## Presentation

### A new rule to override default property category

By default, all properties that don't have a defined category, fall under the default one, labeled "Selected Item(s)". In
some cases there is a need for that category to be labeled differently, and for that purpose there's now a new presentation
rule - `DefaultPropertyCategoryOverride`. Example:

```JSON
{
  "ruleType": "DefaultPropertyCategoryOverride",
  "specification": [{
    "id": "default",
    "label": "My Custom Default Property Category",
  }],
}
```
