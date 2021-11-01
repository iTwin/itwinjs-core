/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelBankClient } from "@bentley/imodelhub-client";
import { readdirSync } from "fs";
import Mocha from "mocha";
import { join } from "path";
import { setIModelBankClient } from "./imodelhub/IModelBankCloudEnv";

export function runTests(
  options: Mocha.MochaOptions,
  invert?: boolean,
  customIModelBankClient?: IModelBankClient
): void {
  const mocha = new Mocha(options);
  if (invert) {
    mocha.invert();
  }
  if (customIModelBankClient) setIModelBankClient(customIModelBankClient);

  const testDirectory = join(__dirname, "imodelhub");

  readdirSync(testDirectory)
    .filter((file) => file.toLowerCase().endsWith("test.js"))
    .forEach((file) => {
      mocha.addFile(join(testDirectory, file));
    });

  mocha.run((failures) => {
    process.exitCode = failures ? 1 : 0; // exit with non-zero status if there were failures
  });
}
