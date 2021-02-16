# ui-test-app Test Application

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

The ui-test-app iTwin.js test application provides an easy way to test the React components in the iTwin.js UI packages, including the 9-zone components, along with other iTwin.js packages.

## Development setup

To start the application, simply install its dependencies and run it:

1. Install the dependencies

  ```sh
  rush install
  ```

2. Build the application using `rush build`, or to rebuild ui-test-app, use `npm run build` in the `imodeljs\test-apps\ui-test-app` directory.

  ```sh
  rush build
  ```

3. There are two servers, a web server that delivers the static web resources (the frontend Javascript, translatable strings, fonts, cursors, etc.), and the backend RPC server that opens the iModel on behalf of the application. Start them both running locally in the `imodeljs\test-apps\ui-test-app` directory:

  ```sh
  npm run start:servers
  ```

4. Open a web browser (e.g., Chrome or Edge), and browse to localhost:3000.

5. You can rebuild any of the iTwin.js packages independently using `npm run build` in the appropriate folder then refresh the browser to pick up those changes and restart the application.

## Snapshot file support

You can now open snapshot files using ui-test-app. These are the relevant environment variables to set before using `npm run start:servers`:

* imjs_TESTAPP_SNAPSHOT_FILEPATH - set to folder containing .bim or .ibim files (required)
* imjs_TESTAPP_START_WITH_SNAPSHOTS - set to 1 to start with File Open dialog (optional)

__Note:__ You must navigate to your snapshot folder the first time you use the File Open dialog. To open other files, click the "Home" button in the upper-left then click "Open Local File". You still need to sign-in.

## Using the Edit Front stage to test writing to iModel

To test writing to an iModel, the '.env' file in the ui-test-app directory should set the variable imjs_TESTAPP_ALLOW_WRITE=1. Optionally this variable can be set in the command shell before starting the servers. Currently only files from iModelHub can be edited.
