# iModelHub client tests

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

This package contains unit and integration tests for the iModelHub client (`@bentley\imodelhub-client` npm package).

## Prerequisites

Refer to the iTwin.js [prerequisites](https://github.com/iTwin/itwinjs-core#prerequisites)

## Running the tests

Start by running the [build instructions from this repository](https://github.com/iTwin/itwinjs-core#build-instructions)

There are multiple sets of tests:

1. `npm test` will run the unit tests
1. `npm run test:integration` will run the integration tests
1. `npm run test:imodel-bank` will run the iModelBank tests

## Test coverage

Since this package contains the test for other packages, the test coverage output is not found in this package output, but in the appropriate package's output.

The tests contained in this package are configured to generate incremental coverage from other packages. For example, if `npm run cover` has already been run for `@bentley/imodelhub-client` then `npm run cover` is run for this package, this package output will contain both the combined coverage results.

This package generates test coverage for `@bentley/imodelhub-client` ([/clients/imodelhub](/clients/imodelhub)).
The coverage output can be found at `lib/test/coverage/full-stack-tests` from the root of the covered package.
