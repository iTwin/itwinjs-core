# Running core tests on ios

The goal of this workflow is to generate a core-test-runner xcode project that can run core tests on ios.

The following takes place on every `npm run ios:build:test-runner`.

1. Webpack Mocha and tests.
    - Note the `entry` field in `test.webpack.config.js`. First, Mocha is required globally and configured programmatically. Then the tests are bundled via glob. Finally, mocha is run programmatically. See tools/build/mocha-reporter/index.js for details on how test termination is signalled to core-test-runner.

2. Copy test assets.
    - The ./lib/ios/assets/ directory is referenced in core-test-runner-template/Config.xcconfig. These assets, which include the Webpacked tests (main.js), are copied in a build step defined in the Xcode project.

3. Build the application and an XCUITest bundle into ./lib/ios/DerivedData/Build. The resulting build can be uploaded to App Center for testing.
