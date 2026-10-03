/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";

// The Certa suites use Mocha's hook names. Keep the migration narrow by adapting those names
// once in the Vitest setup instead of editing every legacy test file.
Object.assign(globalThis, {
  after: afterAll,
  afterEach,
  before: beforeAll,
  beforeEach,
  describe,
  it,
});
