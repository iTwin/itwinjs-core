/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
const jsf = require("json-schema-faker"); // tslint:disable-line:no-var-requires
import { initialize, terminate } from "../IntegrationTests";
import RulesetSchema from "@bentley/ecpresentation-common/Ruleset.schema.json";
import { using } from "@bentley/bentleyjs-core";
import { Ruleset, PropertyGroupingValue, Rule, RuleTypes } from "@bentley/ecpresentation-common";
import { NativePlatformDefinition, createDefaultNativePlatform } from "@bentley/ecpresentation-backend/lib/NativePlatform";
import RulesetManager from "@bentley/ecpresentation-backend/lib/RulesetManager";

before(() => {
  initialize();
  jsf.option({
    optionalsProbability: 0.8,
    maxItems: 5,
    maxLength: 20,
  });
});

after(() => {
  terminate();
});

describe("Rulesets roundtrip", () => {

  let nativePlatform: NativePlatformDefinition;
  let rulesets: RulesetManager;
  before(() => {
    const TNativePlatform = createDefaultNativePlatform(); // tslint:disable-line: variable-name naming-convention
    nativePlatform = new TNativePlatform();
    rulesets = new RulesetManager(() => nativePlatform);
  });
  after(() => {
    nativePlatform.dispose();
  });

  const rulesOrder = [
    RuleTypes.RootNodes, RuleTypes.ChildNodes,
    RuleTypes.Content, RuleTypes.ContentModifier,
    RuleTypes.ImageIdOverride, RuleTypes.InstanceLabelOverride, RuleTypes.LabelOverride,
    RuleTypes.StyleOverride, RuleTypes.Grouping, RuleTypes.CheckBox,
    RuleTypes.DisabledSorting, RuleTypes.PropertySorting,
  ];
  const specialDefaultValues = new Map<string, any>([
    ["condition", ""],
    ["propertyName", ""],
    ["createGroupForUnspecifiedValues", true],
    ["groupingValue", PropertyGroupingValue.DisplayLabel],
    ["sortingValue", PropertyGroupingValue.DisplayLabel],
    ["sortAscending", true],
  ]);
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
  const tweakRuleset = <T extends {[key: string]: any} | any[]>(src: T, out: T) => {
    try {
      if (Array.isArray(src) && Array.isArray(out)) {
        src.forEach((e: any, i: number) => {
          if (typeof e === "object" || Array.isArray(e)) {
            tweakRuleset(e, out[i]);
          }
        });
      } else if (hasIndexSignature(src) && hasIndexSignature(out)) {
        Object.keys(src).forEach((key: string) => {
          const srcValue: any = src[key];
          if ("rules" === key && Array.isArray(srcValue)) {
            // the `rules` array may get reordered after roundtrip
            const compareByPriorities = (lhs: Rule, rhs: Rule) => {
              const lhsPriority = lhs.priority ? lhs.priority : 1000;
              const rhsPriority = rhs.priority ? rhs.priority : 1000;
              return rhsPriority - lhsPriority;
            };
            const compareByNames = (lhs: Rule, rhs: Rule) => {
              if ((lhs.ruleType === RuleTypes.DisabledSorting || lhs.ruleType === RuleTypes.PropertySorting)
                && (rhs.ruleType === RuleTypes.DisabledSorting || rhs.ruleType === RuleTypes.PropertySorting))
                return compareByPriorities(lhs, rhs);
              const namesCompareResult = (rulesOrder.indexOf(lhs.ruleType) - rulesOrder.indexOf(rhs.ruleType));
              if (0 !== namesCompareResult)
                return namesCompareResult;
              return compareByPriorities(lhs, rhs);
            };
            srcValue.sort(compareByNames);
          }
          if (typeof srcValue === "object" || Array.isArray(srcValue)) {
            tweakRuleset(srcValue, out[key]);
          } else if (undefined === out[key]) {
            const setAsDefault = (false === srcValue)
              || (specialDefaultValues.has(key) && srcValue === specialDefaultValues.get(key));
            if (setAsDefault)
              out[key] = srcValue;
          }
        });
      }
    } catch (e) {
      // tslint:disable-next-line:no-console
      console.log(`Source: \r\n${JSON.stringify(src)} \r\nTarget: \r\n${JSON.stringify(out)}`);
      throw e;
    }
  };
  const getRoundtripRuleset = async (sourceRuleset: Ruleset): Promise<Ruleset> => {
    const registered = await rulesets.get(sourceRuleset.id);
    if (!registered)
      throw new Error(`Did not find a registered ruleset with id ${sourceRuleset.id}`);
    const roundtripRuleset = registered.toJSON();
    tweakRuleset(sourceRuleset as any, roundtripRuleset);
    return roundtripRuleset;
  };

  for (let i = 0; i < 10; ++i) {
    it(`ruleset stays the same after roundtrip to/from native platform ${i + 1}`, async () => {
      const sourceRuleset: Ruleset = await jsf.resolve(RulesetSchema);
      fixEmptyStrings(sourceRuleset);
      try {
        await using(await rulesets.add(sourceRuleset), async () => {
          const afterRoundtripRuleset = await getRoundtripRuleset(sourceRuleset);
          expect(afterRoundtripRuleset).to.deep.equal(sourceRuleset,
            `Before: \r\n${JSON.stringify(sourceRuleset)} \r\nAfter: \r\n${JSON.stringify(afterRoundtripRuleset)}`);
        });
      } catch (e) {
        // tslint:disable-next-line:no-console
        console.log(`Threw with:\r\n${JSON.stringify(sourceRuleset)}`);
        throw e;
      }
    });
  }

});
