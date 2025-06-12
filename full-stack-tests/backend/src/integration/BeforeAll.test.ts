/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { KnownTestLocations } from "@itwin/backend-test-support";
import * as path from "path";

const imodelJsCoreDirname = path.join(__dirname, `../../../../..`);

// The Mocha documentation CLAIMS that the below should go into a before hook (or better yet, a
// mochaHooks beforeAll hook), but NEITHER METHOD WORKS. No idea why that is, but putting it at the
// top level of this file DOES work.

// Configure KnownTestLocations before any tests run.
KnownTestLocations.setRootDir(path.join(imodelJsCoreDirname, "core/backend-tests/lib/cjs/test"));
