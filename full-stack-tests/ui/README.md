# iTwin.js UI End-To-End Tests

This package contains end-to-end tests of iTwin.js UI framework.

## Running the tests

The tests are running against a test application which needs to be started before running the tests.

1. Start a web server of a standalone appui-test-app:

  ```sh
  cd .\test-apps\appui-test-app\standalone\
  npm run start:webserver
  ```

2. Run the tests: `npx playwright test`

*Suggested:* use a VSCode extension `ms-playwright.playwright` to run the tests.
