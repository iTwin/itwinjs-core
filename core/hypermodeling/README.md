# Hypermodeling Extension

Copyright © Bentley Systems, Incorporated. All rights reserved.

This package enables a feature called "hyper-modeling". iModels often contain 2d views of spatial model(s) intended to serve as documentation, called "section drawings". These views are produced by applying a section (clip) volume to the spatial geometry and projecting the section cut geometry onto the plane to generate a 2d model. A spatial element called a "section drawing location" is positioned at the section cut plane, with a link to the 2d section view. Hyper-modeling allows the 2d graphics to be displayed in situ with the spatial models at the section drawing location.

## Usage

Before any of the package's APIs are used, the application must call and await the result of `HyperModeling.initialize()`. Typically this will be done when the app starts up. For example:

```ts
  await IModelApp.startup();
  await HyperModeling.initialize();
```

The primary API is `SectionMarkerSetDecorator.showOrHide()`. When enabled, the decorator displays a marker in a viewport for each section drawing location. Clicking the marker applies the section clip and displays the graphics from the section drawing, along with any sheet annotations, in situ with the spatial model(s). Hovering over a marker opens a mini-toolbar with additional interactions:
  * Toggle Section Display: Just like clicking on the marker, toggles whether the view is clipped by the section and the section graphics and annotations are displayed.
  * Align View To Section: Rotate the view to face the section plane.
  * Open Section View: Switch to the 2d section drawing view.
  * Apply Spatial View: Switch to the spatial view that was used to generate the section.

## Tools

All tools included in this package can be invoked using key-ins. A `[toggle]` argument can be one of "ON", "OFF", or "TOGGLE". If omitted, the argument defaults to "TOGGLE".

* `hypermodeling marker display [toggle]`: Controls whether or not section drawing location markers are displayed in the active viewport.
* `hypermodeling marker model|category [toggle]`: Control if the set of markers displayed should be limited to those belonging to the view's displayed models or categories (ON), or if all markers should be displayed regardless of model or category (OFF).
  * `hypermodeling marker default model|category [toggle]`: Control the default settings.
* `hypermodeling marker type section|detail|elevation|plan [toggle]`: Control whether markers of the specified type (section, elevation, etc) are displayed.
  * `hypermodeling marker default type section|detail|elevation|plan [toggle]`: Control the default settings.
* `hypermodeling graphics config [options]`: Configure global display settings. If no additional arguments are supplied, the default options are restored. Otherwise, each argument consists of a name-value pair of the format `name=value`, where value is `1` for `true` or `0` for `false`. Names are case-insensitive. Options:
  * `drawings=0|1`: Whether to display the section drawing graphics when a section marker is toggled on. Default: true.
  * `sheets=0|1`: Whether to display sheet annotations when a section marker is toggled on. Default: true.
  * `clip=0|1`: Whether to apply clip volumes to drawing graphics and sheet annotations. Default: true
  * `boundaries=0|1`: Whether to draw drawing and sheet clip volumes as boundary shapes for debugging purposes. Default: false.

## Contributing

[Contributing to iModel.js](https://github.com/imodeljs/imodeljs/blob/master/CONTRIBUTING.md)
