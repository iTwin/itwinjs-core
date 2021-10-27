# iTwin.js Core Full Stack Tests

This package contains tests of standard iTwin.js RPC interfaces using a local client and server side.
Every test in this directory should test frontend APIs with an actual backend.

The tests run in both Electron and Chrome, using [Certa](https://www.npmjs.com/package/@itwin/certa), and should only include one test RPC interface.

There are two types of tests;

- A set of unit tests that use all local files and do not need an internet connection or the iModelHub
- A second set of integration tests which use the iModelHub, and other parts of the iTwin Platform.
  - See [How to setup and run](#how-to-setup-and-run-integration-tests)

> Note: webpack sometimes runs out of memory, particularly on Linux, when TypeScript sourcemaps are generated for this package. If you need them for debugging purposes, uncomment the block marked "UNCOMMENT THIS BLOCK FOR SOURCE MAPS" in webpack.config.js. Make sure to revert that change before committing.

## How to setup and run integration tests

To run the integration tests, there is an initial configuration step required to get started.

1. Create a `.env` file as a peer of the `package.json` for this package.
1. Populate the newly created `.env` with the following variables:

    ```sh
    # User registered with iTwin Platform
    IMJS_TEST_REGULAR_USER_NAME=
    IMJS_TEST_REGULAR_USER_PASSWORD=

    # Register a new SPA client at https://developer.bentley.com/my-apps.
    # Ensure the client is configured for  the redirect uri and scopes below.
    IMJS_OIDC_BROWSER_TEST_CLIENT_ID=
    IMJS_OIDC_BROWSER_TEST_REDIRECT_URI="http://localhost:3000/signin-callback"
    IMJS_OIDC_BROWSER_TEST_SCOPES="openid email profile organization imodelhub context-registry-service:read-only product-settings-service"
    ```

> Important: Every time the `.env` file, or environment variables, are changed it requires the tests be re-built using `npm run build`
