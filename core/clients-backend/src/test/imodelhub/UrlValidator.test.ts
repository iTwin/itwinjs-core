/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { assert, should } from "chai";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelBaseHandler, UrlDiscoveryClient } from "@bentley/imodeljs-clients";
import { urlLogPath, TestConfig } from "../TestConfig";

export const whitelistRelPath: string = "../assets/whitelist.txt";

should();

// These tests have to run last
// TODO: Fragile test - need to re-enable this after fixing the failure.
describe.skip("Validate iModelHub URL Whitelist", () => {

  function normalizeUrl(loggedUrl: string, hubBaseUrl: string): string | undefined {
    const extractRegex = new RegExp(hubBaseUrl + "\\/s?v(\\d+).(\\d+)\\/Repositories\\/(iModel|Project|Global)--(\\w{8}-\\w{4}-\\w{4}-\\w{4}-\\w{12}|Global)\\/(.*)", "i");

    const matches = loggedUrl.match(extractRegex);
    let normalizedUrl: string = "";
    if (!!matches)
      normalizedUrl = matches.pop() || "";

    if (normalizedUrl === "")
      return undefined;

    const replaceRegex = [
      // All GUIDs
      [/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/g, "********-****-****-****-************"],
      // 40-character alphanumeric Ids in quotes
      [/'\w{40}'/g, "'****************************************'"],
      // Briefcase Id path (any numeric value)
      [/Briefcase\/(\d+)/g, "Briefcase/*"],
      // Changeset Id path (any 40-character alphanumeric Id)
      [/ChangeSet\/(\w){40}/g, "ChangeSet/****************************************"],
      // Message Id path (any numeric value)
      [/messages\/(\d+)/g, "messages/*"],
      // Numeric comparison query string params
      [/(eq|ne|gt|lt)\+(\d+?)\b/g, "$1+*"],
      // String comparison query string params (in quotes or URL-encoded quotes)
      [/(eq|ne|gt|lt)\+('|%27)([a-zA-Z0-9._ \-]+?)('|%27)/g, "$1+'*'"],
      // Other numeric query string params
      [/(=|-)\d+(\b|$)/g, "$1*"]];

    // Genericizes dynamic URL parameters and replaces them with asterisks.
    // Predictable patterns (such as GUIDs and ChangeSetIds) retain their form, others are replaced with a single asterisk.
    for (const regexPair of replaceRegex) {
      const expression = regexPair[0];
      const replacement = regexPair[1];
      normalizedUrl = normalizedUrl.replace(expression, replacement.toString());
    }

    return normalizedUrl === "" ? undefined : normalizedUrl;
  }

  it("Detect whether new iModelHub APIs have been added to which iModelBank has to react", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();
    const whitelistPath: string = path.join(__dirname, whitelistRelPath);
    assert.isTrue(fs.existsSync(whitelistPath), `Whitelist file is expected to exist in the assets to run this test: ${whitelistPath}`);

    const whiteListFileContent: string = fs.readFileSync(whitelistPath, "utf8");
    assert.isTrue(whiteListFileContent.length !== 0, `No whitelist URLs found in ${whitelistPath}`);
    // Split into line array
    const whitelistUrls: string[] = whiteListFileContent.split(/\r?\n/);

    assert.isTrue(fs.existsSync(urlLogPath), `URL log file ${urlLogPath} is expected to exist run this test.`);
    const logFileContent: string = fs.readFileSync(urlLogPath, "utf8");
    assert.isTrue(logFileContent.length !== 0, `No logged URLs found in ${urlLogPath}. Make sure to have run the full suite of integration tests before.`);
    // filter out duplicate URLs by putting the lines in a set and create an array from it again
    const loggedUrls: string[] = Array.from(new Set(logFileContent.split(/\r?\n/)));

    let baseUrl: string = await new UrlDiscoveryClient().discoverUrl(new ClientRequestContext(), IModelBaseHandler.searchKey, undefined);
    if (baseUrl.endsWith("/") || baseUrl.endsWith("\\"))
      baseUrl = baseUrl.substring(1, baseUrl.length - 1);

    const violatingUrls: string[] = [];
    for (const url of loggedUrls) {
      if (url.length === 0)
        continue;

      const normalizedUrl: string | undefined = normalizeUrl(url, baseUrl);
      if (!normalizedUrl || normalizedUrl.length === 0)
        continue;

      if (whitelistUrls.indexOf(normalizedUrl) < 0)
        violatingUrls.push(url);
    }

    const violatingUrlsString: string = violatingUrls.length === 0 ? "" : violatingUrls.reduce((str: string, current: string) => str + "|" + current);
    assert.isTrue(violatingUrls.length === 0, `The URLs '${violatingUrlsString}' are not whitelisted.\n` +
      "If this is caused by a necessary API change, update the whitelist and notify iModelBank of the updates. " +
      "If the whitelist violation is unintentional, modify your changes to use existing API functionality.");
  });
});
