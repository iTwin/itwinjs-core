# Hypermodeling Extension

Copyright © Bentley Systems, Incorporated. All rights reserved.

An iModel.js Extension that enables interaction with section drawing locations in the context of a spatial view.
The extension displays a marker in the view for each section drawing location. Clicking the marker applies the section clip and displays the graphics from the section drawing, along with any sheet annotations, in situ with the spatial model(s). Hovering over a marker opens a mini-toolbar with additional interactions:
  * Toggle Section Display: Just like clicking on the marker, toggles whether the view is clipped by the section and the section graphics and annotations are displayed.
  * Align View To Section: Rotate the view to face the section plane.
  * Open Section View: Switch to the 2d section drawing view.
  * Apply Spatial View: Switch to the spatial view that was used to generate the section.

This is an example of an extension that can be added to iModel.js host applications.
See http://imodeljs.org for comprehensive documentation on the iModel.js API and the various constructs used in this sample.

## Development Setup

1. Select and prepare an iModel.js host application. You can use the [Simple Viewer App](https://github.com/imodeljs/imodeljs-samples/tree/master/interactive-app/simple-viewer-app), for example.

2. The dependencies are installed as part of "rush install" in the iModel.js repository.

3. Build the extension as part of the "rush build" in the iModel.js repository, or separately build using the npm build command.

  ```sh
  npm run build
  ```

4. Copy all the output files in the lib/build directory tree to imjs_extensions/hyperModeling directory in the web resources of the host application. On Windows, assuming `ImjsRoot` is an environment variable pointing to your imodeljs repository directory, and `AppRoot` points to your application directory, the following will link the extension into your application:

  ```sh
  cd %AppRoot%\build\
  mkdir imjs_extensions
  cd imjs_extensions
  mklink /d hypermodeling $ImjsRoot\extensions\hypermodeling\lib\extension\
  ```

5. Start the host application - go to its directory and run (typically):

  ```sh
  npm run start:servers
  ```

6. Open a web browser (e.g., Chrome or Edge), and browse to localhost:3000.

7. Start the extension using the ExtensionTool:

  ```ts
  ExtensionTool.run("localhost:3000/hyperModeling");
  ```

## Interface

Like all Extensions, the hypermodeling extension exposes no API. However, its behavior can be controlled at run-time using key-in commands.

The following key-ins accept an optional "toggle" argument: "ON", "OFF", or "TOGGLE". If omitted, the argument defaults to "TOGGLE":
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
