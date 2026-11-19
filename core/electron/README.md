# @itwin/core-electron

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/core-electron__ package contains the electron utilities to write an iTwin.js application based on Electron.

## Process-specific entry points

Import the renderer API from `@itwin/core-electron/renderer` and the main-process API from `@itwin/core-electron/main`. The renderer entry resolves to the ESM build for `import` and to CommonJS for `require`; its relative imports are explicit so Node ESM and browser bundlers can resolve it. The main-process entry remains CommonJS in both cases.

## Building and testing

Build the package and its dependencies from the repository root with `rush build --to @itwin/core-electron`. The build compiles the libraries and copies static test assets.

From this package directory, run `rushx test:integration`, which runs both Vitest suites against the built output:

- `rushx test:integration:backend` runs each backend test in its own Electron main process.
- `rushx test:integration:frontend` runs the frontend tests in a real Electron window through the `@itwin/vitest-browser-bridge` provider, with this package's `ElectronPreload`.

Test runs write JUnit results under `lib/test`, and `lib` is the build's cached output, so each build first clears `lib`. That keeps results from an earlier test run out of the build cache. Run the tests after building.

## Documentation

See the [iTwin.js](https://www.itwinjs.org) documentation for more information.
