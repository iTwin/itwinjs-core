/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll } from "vitest";
import { setupFrontend, teardownFrontend } from "./testSetup";

beforeAll(setupFrontend);
afterAll(teardownFrontend);
