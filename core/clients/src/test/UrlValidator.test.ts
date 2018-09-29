/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";

import { whitelistPath, logPath } from "./TestConfig";

const whitelistViolationDetails = "If this is caused by a necessary API change, update the whitelist and notify iModelBank of the updates. " +
  "If the whitelist violation is unintentional, modify your changes to use existing API functionality.";

const regex = [
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

/**
 * Extracts the meaningful portion of an imodelhubapi URL from a single log file line
 * @param url the full line of log text
 * @returns the portion of the URL beyond the repository ID, or an empty string if no URL is found
 */
function extractUrl(url: string): string {
  const matches = url.match(/.+imodeljs-clients\.Url.+https:\/\/(dev|qa)-imodelhubapi.bentley.com\/s?v(\d+).(\d+)\/Repositories\/(iModel|Project|Global)--(\w{8}-\w{4}-\w{4}-\w{4}-\w{12}|Global)\/(.*)/);
  if (matches !== null) {
    return matches.pop() || "";
  }
  return "";
}

/**
 * Genericizes dynamic URL parameters and replaces them with asterisks.
 * Predictable patterns (such as GUIDs and ChangeSetIds) retain their form, others are replaced with a single asterisk.
 * @param url the URL to genericize
 * @returns the URL with dymanic fields replaced
 */
function genericizeUrl(url: string): string {
  if (url === "")
    return url;

  for (const regexPair of regex) {
    const expression = regexPair[0];
    const replacement = regexPair[1];
    url = url.replace(expression, replacement.toString());
  }

  return url;
}

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

  it("should format the log URLs", () => {
    // Remove duplicates
    logURLs = Array.from(new Set(logURLs));
    // Isolate and genericize URLs
    logURLs.forEach((url, index, array) => {
      url = extractUrl(url);
      url = genericizeUrl(url);
      array[index] = url;
    });
    // Assert URL has been formatted
    logURLs.forEach((url) => {
      chai.expect(url.indexOf("https://")).to.equal(-1);
    });
  });

  it("should only use whitelisted URLs", () => {
    logURLs.forEach((url) => {
      if (url !== "") {
        chai.expect(whitelistURLs.indexOf(url), `The URL "${url}" is not whitelisted.\n${whitelistViolationDetails}`).to.be.above(-1);
      }
    });
  });
});
