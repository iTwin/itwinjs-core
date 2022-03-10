# Running core tests on ios

Steps 1 and 2 occur when running `npm run ios:build:tests`

1. Webpack Mocha and tests.
    - Note the `entry` field in ios.webpack.config.js. In configureMocha.js, Mocha is configured programmatically. The TEST_RESULTS_PATH, which is set in ViewController.swift, is passed to the BentleyMochaReporter. The tests are then bundled using glob. Lastly, runMocha.js runs the webpacked tests and signals to IModelJsMobile on process exit.

2. Copy test assets.
    - Test assets are copied to lib/ios/assets.

3. Build and Run core-test-runner.
    - The ASSET_ROOT environmnet vaiable is set to "./lib/ios/assets/" in core-test-runner/Config.xcconfig. They are copied in a "Run Script" build phase, defined in the app target in core-test-runner.xcodeproj.
    - The `runTests` function is triggered when the ContentView appears. It creates an instance of IModelJsHost and directs it to main.js, produced in step 1 above. The callback is triggered by `notifyListening` (runMocha.js).

4. App Center (optional)
    - Only messages emitted via `logger.log` will appear in the App Center Device Logs. More output is generated when the app is run in XCode. These logs are fetched and parsed into XML in processLogs.js (invoked by the ci-ios pipeline).