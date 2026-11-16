# @itwin/core-electron

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/core-electron__ package contains the electron utilities to write an iTwin.js application based on Electron.

## Process-specific entry points

Import the renderer API from `@itwin/core-electron/renderer` and the main-process API from `@itwin/core-electron/main`. The renderer entry resolves to the ESM build for `import` and to CommonJS for `require`; its relative imports are explicit so Node ESM and browser bundlers can resolve it. The main-process entry remains CommonJS in both cases.

## Building and testing

Build the package and its dependencies from the repository root with `rush build --to @itwin/core-electron`. The build compiles the libraries and copies static test assets, but does not webpack frontend tests.

From this package directory, run `rushx test:integration` or `rushx test:integration:frontend`. The frontend test command runs `test:prepare` to bundle the tests with the current environment before starting Electron. To prepare the bundle without running tests, use `rushx test:prepare`; this replaces the package's former `webpack:test` script.

Bundle paths are unchanged. Each build clears previous frontend webpack output before compilation so an earlier test run cannot contaminate the build cache. Run test preparation after building.

## Documentation

See the [iTwin.js](https://www.itwinjs.org) documentation for more information.
