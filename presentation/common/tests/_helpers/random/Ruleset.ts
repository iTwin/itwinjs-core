/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const jsf = require("json-schema-faker"); // tslint:disable-line:no-var-requires
import RulesetSchema from "@common/Ruleset.schema.json";
import { Ruleset } from "@common/index";

jsf.option({
  optionalsProbability: 0.8,
  maxItems: 5,
  maxLength: 20,
});

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
  const ruleset: Ruleset = await jsf.resolve(RulesetSchema);
  fixEmptyStrings(ruleset);
  return ruleset;
};
