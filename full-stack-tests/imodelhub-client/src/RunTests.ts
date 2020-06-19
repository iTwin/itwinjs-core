/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as Mocha from "mocha";
import { readdirSync } from "fs";
import { join } from "path";

export function runTests(options: Mocha.MochaOptions, invert?: boolean): void {
  const mocha = new Mocha(options);
  if (invert) {
    mocha.invert();
  }

  const testDirectory = join(__dirname, "imodelhub");

  readdirSync(testDirectory).filter((file) => file.toLowerCase().endsWith("test.js")).forEach((file) => {
    mocha.addFile(join(testDirectory, file));
  });

  mocha.run((failures) => {
    process.exitCode = failures ? 1 : 0;  // exit with non-zero status if there were failures
  });
}
