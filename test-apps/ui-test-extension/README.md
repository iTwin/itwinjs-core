# Dialog Items Example Extension

Copyright © Bentley Systems, Incorporated. All rights reserved.

An iModel.js Extension that demonstrates how to use the DialogItem and related interfaces in @bentley/ui-abstract to create user interfaces without writing any React code.

This extension is an example of an extension that can be added to iModel.js host applications.
See http://imodeljs.org for comprehensive documentation on the iModel.js API and the various constructs used in this sample.

## Development Setup

1. Select and prepare an iModel.js host application. You can use the [Simple Viewer App](https://github.com/imodeljs/imodeljs-samples/tree/master/interactive-app/simple-viewer-app), for example.

2. The dependencies are installed as part of "rush install" in the iModel.js repository.

3. Build the extension as part of the "rush build" in the iModel.js repository, or separately build using the npm build command.

  ```sh
  npm run build
  ```

4. Copy all the output files in the lib/extension directory tree to imjs_extensions/ui-test directory in the build directory of the host application.

### To run in ui-test-app, on a Windows machine, use the following key-ins from the root imodeljs directory.

  ```sh
  cd test-apps\ui-test-app
  cd build
  md imjs_extensions
  cd imjs_extensions
  mklink /d ui-test ..\..\..\ui-test-extension\lib\extension
  cd ..\..
  npm run start:servers
  ```

5. Start the host application - go to its directory and run:

  ```sh
  npm run start:servers
  ```

6. Open a web browser (e.g., Chrome or Edge), and browse to localhost:3000.

7. Start the extension using the ExtensionTool - ExtensionTool.run("ui-test");

## Contributing

[Contributing to iModel.js](https://github.com/imodeljs/imodeljs/blob/master/CONTRIBUTING.md)
