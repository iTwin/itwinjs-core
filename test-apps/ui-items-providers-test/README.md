# ui-items-providers-test

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

This is an example of a package that can be added to provide tools and augment the UI in an iModelApp. When initialized this package will register different stages and UiItemProviders to provide tools, widgets, and status bar items to the stages. See <http://itwinjs.org> for comprehensive documentation on the iTwin.js API and the various constructs used in this test.

Included in this package are:

- `SampleTool` that shows how to implement a tool with tool settings.
- `GenericLocateTool` that shows how to implement a tool that requires user to first locate an element.
- `OpenAbstractDialogTool` that shows how to generate a dialog without creating "react" components.
- `GeneralUiItemsProvider` that provide tool buttons and a status bar item to stages set usage set to "StageUsage.General"
- `NetworkTracingFrontstage` that defines a new stage to add to iModelApp.
- `NetworkTracingUiItemsProvider` that provide tool buttons and widgets to NetworkTracingFrontstage.
- `TestProviderState` that define package specific state properties to add to the apps Redux store.
- `CustomFrontstage` that define a frontstage the show an iModel view and a custom content view populated via `SampleCustomContent`

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
