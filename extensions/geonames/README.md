# Geonames Example Extension

Copyright © Bentley Systems, Incorporated. All rights reserved.

An iModel.js Extension that displays markers at locations of named geographic features from the [GeoNames](https://www.geonames.org/) geographical database. Hovering over a marker shows a tooltip containing the name of the location and its population.  Clicking a marker causes the view to zoom to that location.

This extension is an example of a extension that can be added to iModel.js host applications. See http://imodeljs.org for comprehensive documentation on the iModel.js API and the various constructs used in this sample.

## Development Setup

1. Select and prepare an iModel.js host application. You can use the [Simple Viewer App](https://imodeljs.gitbub.io/simple-viewer-app), for example.

2. The dependencies are installed as part of "rush install" in the iModel.js monorepository.

3. Build the extension as part of the "rush build" in the iModel.js monorepository, or separately build using the npm build command.

  ```sh
  npm run build
  ```

4. Copy all the output files in the lib/build directory tree to imjs_extensions/geoPhoto directory in the web resources of the host application.

5. Start the host application - go to its directory and run:

  ```sh
  npm run start:servers
  ```

6. Open a web browser (e.g., Chrome or Edge), and browse to localhost:3000.

7. Start the extension using the ExtensionTool - ExtensionTool.run("localhost:3000/geoNames");

## Contributing

[Contributing to iModel.js](https://github.com/imodeljs/imodeljs/blob/master/CONTRIBUTING.md)
