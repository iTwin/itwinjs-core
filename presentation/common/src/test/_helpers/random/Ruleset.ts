/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// eslint-disable-next-line
const RulesetSchema = require("../../../../../Ruleset.schema.json");
import type { Ruleset } from "../../../presentation-common";

type IndexedType = { [key: number]: any } | { [key: string]: any };
const hasIndexSignature = (obj: any): obj is IndexedType => {
  return typeof obj === "object" || Array.isArray(obj);
};
const fixEmptyStrings = (obj: any) => {
  for (const key in obj) {
    if (!obj.hasOwnProperty(key))
      continue;
    const value: unknown = obj[key];
    if (hasIndexSignature(value)) {
      fixEmptyStrings(value);
    } else if (typeof value === "string") {
      obj[key] = value.trim();
      if (obj[key] === "")
        obj[key] = "was empty string";
    }
  }
};

/**
 * @internal Used for testing only.
 */
export const createRandomRuleset = async () => {
  const jsf = require("json-schema-faker"); // eslint-disable-line @typescript-eslint/no-var-requires
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
