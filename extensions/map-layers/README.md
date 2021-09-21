# MapLayers Extension/Package

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

An iTwin.js Extension that adds a widget for attaching and updating map attachments in a view:

This extension serves as an example of a extension that can be added to iTwin.js host applications.
See <http://itwinjs.org> for comprehensive documentation on the iTwin.js API and the various constructs used in this sample.

This package can also be installed into an application and the method MapLayersUI.initialized() called during the host IModelApps initialize processing.

## Development Setup

1. Select and prepare an iTwin.js host application. You can use the [ui-test-app] to host the extension, for example.

2. The dependencies are installed as part of "rush install" in the iTwin.js repository.

3. Build the extension as part of the "rush build" in the iTwin.js repository, or separately build using the npm build command.

  ```sh
  npm run build
  ```

5. Start the host application - go to its directory and run:

  ```sh
  npm run start:servers
  ```

6. Open a web browser (e.g., Chrome or Edge), and browse to localhost:3000.

7. Start the extension using the ExtensionTool - ExtensionTool.run("map-layers");

  Optionally in ui-test-app use the key-in browser tool and set Key-in to "load extension" and Arguments to "map-layers".  Once started look for the "Map Layers" widget in the right panel.

## Contributing

[Contributing to iTwin.js](https://github.com/imodeljs/imodeljs/blob/master/CONTRIBUTING.md)
