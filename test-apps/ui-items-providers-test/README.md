# ui-items-providers-test

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

This is an example of a package that can be added to provide tools and augment the UI in an iModelApp. When initialized this package will register different stages and UiItemProviders to provide tools, widgets, and status bar items to the stages. See <http://itwinjs.org> for comprehensive documentation on the iTwin.js API and the various constructs used in this test.

## Development Setup

1. The test application ui-test-app serves as the default an iTwin.js host application and is already set up to take a dependency on this package.

2. The dependencies are installed as part of "rush install" in the iTwin.js repository.

3. Build the package as part of the "rush build" in the iTwin.js repository, or separately build using the npm build command.

  ```sh
  npm run build
  ```

4. Once the package is built, change to the directory `ui-test-app` and build that application.

  ```sh
  npm run build
  ```

5. Start the ui-test-app

  ```sh
  npm run start:servers
  ```

6. Open a web browser (e.g., Chrome or Edge), and browse to localhost:3000.

7. Use key-in palette to load the activate/initialize the ui-items-providers-test. Once loaded, buttons and a status bar item are added to the current stage and new stage entries are inserted into the backstage menu.

- press `Ctrl+F2`
- enter `load test provider`

## Contributing

[Contributing to iTwin.js](https://github.com/iTwin/itwinjs-core/blob/master/CONTRIBUTING.md)
