# ui-test-extension

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

This is an example of a "run time" extension package that can be used in iTwin.js host applications to augment the UI components displayed
in the main design frontstage. See <http://itwinjs.org> for comprehensive documentation on the iTwin.js API and the various constructs used in this sample.

## Development Setup

1. The test application ui-test-app servers as the default an iTwin.js host application.

2. The dependencies are installed as part of "rush install" in the iTwin.js repository.

3. Build the extension as part of the "rush build" in the iTwin.js repository, or separately build using the npm build command.

  ```sh
  npm run build
  ```

4. Once the extension is built, change to the directory `ui-test-app` and build that application.

  ```sh
  npm run build
  ```

5. Start the ui-test-app

  ```sh
  npm run start:servers
  ```

6. Open a web browser (e.g., Chrome or Edge), and browse to localhost:3000.

7. Use key-in palette to load the activate/initialize the ui-test-extension.

- press `Ctrl+F2`
- enter `load test extension`

## Contributing

[Contributing to iTwin.js](https://github.com/iTwin/itwinjs-core/blob/master/CONTRIBUTING.md)
