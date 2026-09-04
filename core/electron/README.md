# @itwin/core-electron

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/core-electron__ package contains the electron utilities to write an iTwin.js application based on Electron.

## Process-specific entry points

Import the renderer API from `@itwin/core-electron/frontend` and the main-process API from `@itwin/core-electron/backend`. The renderer entry resolves to the ESM build for `import` and to CommonJS for `require`; its relative imports are explicit so Node ESM and browser bundlers can resolve it. The main-process entry remains CommonJS in both cases.

## Documentation

See the [iTwin.js](https://www.itwinjs.org) documentation for more information.
