/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import RulesetSchema from "../../../Ruleset.schema.json";
import { Ruleset } from "../../../lib";

const hasIndexSignature = (o: any): o is { [key: string]: string } => {
  return typeof o === "object";
};
const fixEmptyStrings = <T extends { [key: string]: any }>(obj: T) => {
  if (Array.isArray(obj) || hasIndexSignature(obj)) {
    for (const key in obj) {
      if (!obj.hasOwnProperty(key))
        continue;
      const value: any = obj[key];
      if (typeof value === "object" || Array.isArray(value)) {
        fixEmptyStrings(value);
      } else if (typeof value === "string") {
        obj[key] = value.trim();
        if (obj[key] === "")
          obj[key] = "was empty string";
      }
    }
  }
};

export const createRandomRuleset = async () => {
  const jsf = require("json-schema-faker"); // tslint:disable-line:no-var-requires
  jsf.option({
    optionalsProbability: 0.8,
    maxItems: 5,
    maxLength: 20,
  });
  const ruleset: Ruleset = jsf.generate(RulesetSchema);
  jsf.reset();
  fixEmptyStrings(ruleset);
  return ruleset;
};
