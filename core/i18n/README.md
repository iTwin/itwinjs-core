# @itwin/core-i18n

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/core-i18n__ package contains classes related to internationalization and localization.

## Building and testing

Build the package and its dependencies from the repository root with `rush build --to @itwin/core-i18n`. The build compiles the libraries, but does not webpack browser tests.

From this package directory, run `rushx test`, `rushx cover`, `rushx test:chrome`, or `rushx test:debug`. Each path runs `test:prepare` to bundle the tests with the current environment before starting Chrome. To prepare the bundles without running tests, use `rushx test:prepare`; this replaces the package's former `webpack:test` script.

Bundle paths are unchanged. Each build clears previous webpack output before compilation so an earlier test run cannot contaminate the build cache. Run test preparation after building.

## Documentation

See the [iTwin.js](https://www.itwinjs.org) documentation for more information.
