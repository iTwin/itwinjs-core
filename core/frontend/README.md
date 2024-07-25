# @itwin/core-frontend

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/core-frontend__ package contains the frontend (specific to running in a web browser) classes for querying, visualizing, and interacting with iModels.

## Documentation

See the [iTwin.js](https://www.itwinjs.org) documentation for more information.

## Source code layout

The source code is laid out according to the following top-level directory structure:

- `src/common/` contains code that is safe to use in a Worker and on the main thread. Code within this directory must not import files outside of `src/common/`, and must also avoid taking dependencies on APIs that are only usable on the main thread (e.g., the DOM APIs) or only usable on Workers (e.g., `importScripts`).
- `src/workers/` contains code that can only be used in Workers, along with specific Worker scripts delivered with the @itwin/core-frontend package. Code within this directory may import files from `src/common/`.
- All other files in `src/` - excluding the two subdirectories listed above - contain code that can only be used on the main thread. They can import from `src/common/`, but not from `src/workers/`.
