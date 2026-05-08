/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "src/test",
    include: ["**/*.test.ts"],
  },
});
