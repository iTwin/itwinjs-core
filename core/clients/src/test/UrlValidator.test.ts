/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";

import { whitelistPath, logPath } from "./TestConfig";

const whitelistViolationDetails = "If this is caused by a necessary API change, update the whitelist and notify iModelBank of the updates. " +
  "If the whitelist violation is unintentional, modify your changes to use existing API functionality.";

describe("URL Whitelist Validator", () => {
  let logURLs: string[] = [];
  let whitelistURLs: string[] = [];

  it("should load the whitelist URLs", () => {
    const data = fs.readFileSync(whitelistPath, "utf8");
    // Split into line array
    whitelistURLs = data.split(/\r?\n/);
    // Assert length > 0
    chai.expect(whitelistURLs.length, `No whitelist URLs found in ${whitelistPath}`).to.be.above(0);
  });

  it("should load the log URLs", () => {
    const data = fs.readFileSync(logPath, "utf8");
    // Split into line array
    logURLs = data.split(/\r?\n/);
    // Assert length > 0
    chai.expect(logURLs.length, `No log URLs found in ${logPath}`).to.be.above(0);
  });

  it("should only use whitelisted URLs", () => {
    logURLs.forEach((url) => {
      if (url !== "") {
        chai.expect(whitelistURLs.indexOf(url), `The URL "${url}" is not whitelisted.\n${whitelistViolationDetails}`).to.be.above(-1);
      }
    });
  });
});
