# Hypermodeling Extension

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

This package enables a feature called "hyper-modeling". iModels often contain 2d views of spatial model(s) intended to serve as documentation, called "section drawings". These views are produced by applying a section (clip) volume to the spatial geometry and projecting the section cut geometry onto the plane to generate a 2d view. A spatial element called a "section drawing location" is positioned at the section cut plane, with a link to the 2d section view. Hyper-modeling allows the 2d graphics to be displayed in situ with the spatial models at the section drawing location.

## Usage

Before any of the package's APIs are used, the application must call and await the result of `HyperModeling.initialize()`. Typically this will be done when the app starts up. For example:

```ts
  await IModelApp.startup();
  await HyperModeling.initialize();
```

The API entry point is `HyperModeling`. Use `HyperModeling.startOrStop()` to toggle hypermodeling features for a `Viewport`.  When enabled, a marker is displayed in the viewport for each section drawing location. Clicking the marker applies the section clip and displays the graphics from the section drawing, along with any sheet annotations, in situ with the spatial model(s). Hovering over a marker opens a mini-toolbar with additional interactions:
  * Apply Section: Applies the section clip and displays the section graphics and sheet annotations.
  * Open Section: Navigate to the 2d section drawing view.
  * Open Sheet: If the section drawing was placed onto a sheet, navigate to the corresponding view attachment.

## Key-ins

The package exposes the following key-in commands:

* `hypermodeling [toggle]`: Enables or disables hypermodeling for the active viewport. Arguments:
  * `toggle`: "ON" to enable hypermodeling, "OFF" to disable, or "TOGGLE" to invert the current state. Default: "TOGGLE".
* `hypermodeling marker config [category] [model] [hiddenSectionTypes]`: Changes aspects of the marker display configuration for the active viewport. If no arguments are supplied, all settings are reset to defaults. Arguments:
  * `category=0|1`: If 1, only markers belonging to visible categories are displayed; if 0, markers on all categories are displayed.
  * `model=0|1`: If 1, only markers belonging to visible models are displayed; if 0, markers in all models are displayed.
  * `hiddenSectionTypes=p|e|s|d`: Specifies types of markers that should not be displayed - (p)lan, (e)levation, (d)etail, and (s)ection. Multiple types can be specified - e.g., `hiddenSectionTypes=pd` indicates plan and detail section markers should be hidden.
* `hypermodeling merker default config`: Changes aspects of the global marker display configuration used for any subsequently creted HyperModelingDecorators. The arguments are the same as for `hypermodeling marker config`.
* `hypermodeling graphics config [drawing] [sheet] [clip] [boundaries]`: Changes aspects of the global configuration affecting how section graphics are displayed. Each argument is of the form `name=0|1` where 0 indicates the option should be disabled and 1 indicates it should be enabled. Arguments:
  * `drawing=0|1`: Whether to display the section drawing graphics.
  * `sheet=0|1`: Whether to draw the sheet annotations.
  * `clip=0|1`: Whether to apply clip volumes to the 2d graphics.
  * `boundaries=0|1`: Whether to visualize 2d clip volumes as boundary shapes for debugging.

## Contributing

[Contributing to iTwin.js](https://github.com/imodeljs/imodeljs/blob/master/CONTRIBUTING.md)
