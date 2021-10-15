# Geonames Example Extension

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

An iTwin.js Extension that displays markers at locations of named geographic features from the [GeoNames](https://www.geonames.org/) geographical database. Hovering over a marker shows a tooltip containing the name of the location and its population.  Clicking a marker causes the view to zoom to that location.

This extension is an example of a extension that can be added to iTwin.js host applications. See <http://itwinjs.org> for comprehensive documentation on the iTwin.js API and the various constructs used in this sample.

## Development Setup

1. Select and prepare an iTwin.js host application. You can use the [Simple Viewer App](https://github.com/imodeljs/imodeljs-samples/tree/master/interactive-app/simple-viewer-app), for example.

2. The dependencies are installed as part of "rush install" in the iTwin.js monorepository.

3. Build the extension as part of the "rush build" in the iTwin.js monorepository, or separately build using the npm build command.

  ```sh
  npm run build
  ```

4. Copy all the output files in the lib/build directory tree to the host app's ./build/imjs_extensions/geoNames directory.

5. Start the host application - go to its directory and run:

  ```sh
  npm run start:servers
  ```

6. Open a web browser (e.g., Chrome or Edge), and browse to localhost:3000.
7. Add the following line to the app's startup method - `ExtensionTool.run("localhost:3000/geoNames");`.  Where `localhost:3000` is the location of the app locally
8. The following toolIds will be available: `GeoNamesOnTool`, `GeoNamesOffTool`, `GeoNamesUpdateTool`

## Contributing

[Contributing to iTwin.js](https://github.com/iTwin/itwinjs-core/blob/master/CONTRIBUTING.md)
