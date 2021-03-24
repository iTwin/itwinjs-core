/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, should } from "chai";
import * as fs from "fs";
import * as path from "path";
import { Config, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelBaseHandler } from "@bentley/imodelhub-client";
import { ITwinClientLoggerCategory } from "@bentley/itwin-client";

export const whitelistRelPath: string = "../assets/whitelist.txt";

should();
const logFilePath = path.join(__dirname, "./iModelClientsTests.log");
const logFileStream = fs.createWriteStream(logFilePath, { flags: "a" });
// console.log("Log File created at: " + logFilePath);

// The Request URLs are captured separate. The log file is used by the Hub URL whitelist validation.
const urlLogPath = path.join(__dirname, "./requesturls.log");
const urlLogFileStream = fs.createWriteStream(urlLogPath, { flags: "a" });
// console.log("URL Log file created at: " + urlLogPath);

function logFunction(logLevel: string, category: string, message: string) {
  if (category === ITwinClientLoggerCategory.Request)
    urlLogFileStream.write(`${message}\n`);
  else
    logFileStream.write(`${logLevel}|${category}|${message}\n`);
}

// Initialize logger to file
Logger.initialize(
  (category: string, message: string): void => { logFunction("Error", category, message); },
  (category: string, message: string): void => { logFunction("Warning", category, message); },
  (category: string, message: string): void => { logFunction("Info", category, message); },
  (category: string, message: string): void => { logFunction("Trace", category, message); });

// Note: Turn this off unless really necessary - it causes Error messages on the
// console with the existing suite of tests, and this is quite misleading,
// especially when diagnosing CI job failures.
const loggingConfigFile: string = Config.App.get("imjs_test_logging_config", "");
if (!!loggingConfigFile) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Logger.configureLevels(require(loggingConfigFile));
}

// log all request URLs as this will be the input to the Hub URL whitelist test
Logger.setLevel(ITwinClientLoggerCategory.Request, LogLevel.Trace);

// These tests have to run last
// TODO: Fragile test - need to re-enable this after fixing the failure.
describe.skip("Validate iModelHub URL Whitelist", () => {

  function normalizeUrl(loggedUrl: string, hubBaseUrl: string): string | undefined {
    const extractRegex = new RegExp(`${hubBaseUrl}\\/s?v(\\d+).(\\d+)\\/Repositories\\/(iModel|Context|Global)--(\\w{8}-\\w{4}-\\w{4}-\\w{4}-\\w{12}|Global)\\/(.*)`, "i");

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

  it("Detect whether new iModelHub APIs have been added to which iModelBank has to react (#integration)", async () => {
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

    let baseUrl: string = (IModelBaseHandler as any).baseUrl; //  await new UrlDiscoveryClient().discoverUrl(new ClientRequestContext(), IModelBaseHandler.searchKey, undefined);
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

    const violatingUrlsString: string = violatingUrls.length === 0 ? "" : violatingUrls.reduce((str: string, current: string) => `${str}|${current}`);
    assert.isTrue(violatingUrls.length === 0, `The URLs '${violatingUrlsString}' are not whitelisted.\n` +
      "If this is caused by a necessary API change, update the whitelist and notify iModelBank of the updates. " +
      "If the whitelist violation is unintentional, modify your changes to use existing API functionality.");
  });
});
