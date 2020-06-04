---
ignore: true
---
# NextVersion

## Cel-shaded display

[DisplayStyle]($backend)s now support displaying 3d models in a cel-shaded "comic book" style using the `numCels` property of [LightSettings]($common).

![cel-shaded display](./assets/cel-shaded.png)
<p align="center">Cel-shaded display</p>

## Changes in `@bentley/ui-framework`

### `LayoutManager` removed

`LayoutManager.restoreLayout()` is replaced by `FrontstageDef.restoreLayout()`
`LayoutManager.showWidget()` is replaced by `WidgetDef.show()`
`LayoutManager.expandWidget()` is replaced by `WidgetDef.expand()`

### `StagePanelDef` changes

`StagePanelDef.trySetCurrentSize()` is replaced by `StagePanelDef.size` setter.
