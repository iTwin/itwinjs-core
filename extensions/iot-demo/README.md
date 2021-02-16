# IotDemo Example Extension

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

An iTwin.js Extension that loosely emulates the functions of a network of IoT devices that monitor a building's temperature, heating and cooling, Co2 levels, smoke, and fire alarms.

This extension serves as an example of a extension that can be added to iTwin.js host applications.
See <http://itwinjs.org> for comprehensive documentation on the iTwin.js API and the various constructs used in this sample.

## Development Setup

1. Select and prepare an iTwin.js host application. You can use the [Simple Viewer App](https://github.com/imodeljs/imodeljs-samples/tree/master/interactive-app/simple-viewer-app), for example.

2. The dependencies are installed as part of "rush install" in the iTwin.js repository.

3. Build the extension as part of the "rush build" in the iTwin.js repository, or separately build using the npm build command.

  ```sh
  npm run build
  ```

4. Copy all the output files in the lib/build directory tree to imjs_extensions/iotDemo directory in the web resources of the host application.

5. Start the host application - go to its directory and run:

  ```sh
  npm run start:servers
  ```

6. Open a web browser (e.g., Chrome or Edge), and browse to localhost:3000.

7. Start the extension using the ExtensionTool - ExtensionTool.run("localhost:3000/iotDemo");

## Contributing

[Contributing to iTwin.js](https://github.com/imodeljs/imodeljs/blob/master/CONTRIBUTING.md)
