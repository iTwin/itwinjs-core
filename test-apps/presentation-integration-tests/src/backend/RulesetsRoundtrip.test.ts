/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../IntegrationTests";
import { createRandomRuleset } from "@helpers/random";
import { using } from "@bentley/bentleyjs-core";
import { Ruleset, PropertyGroupingValue, Rule, RuleTypes } from "@bentley/presentation-common";
import { NativePlatformDefinition, createDefaultNativePlatform } from "@bentley/presentation-backend/lib/NativePlatform";
import RulesetManager from "@bentley/presentation-backend/lib/RulesetManager";

describe("Rulesets roundtrip", () => {

  let nativePlatform: NativePlatformDefinition;
  let rulesets: RulesetManager;

  before(() => {
    initialize();

    const TNativePlatform = createDefaultNativePlatform(); // tslint:disable-line: variable-name naming-convention
    nativePlatform = new TNativePlatform();

    rulesets = new RulesetManager(() => nativePlatform);
  });

  after(() => {
    nativePlatform.dispose();
    terminate();
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
  const tweakRuleset = <T extends { [key: string]: any } | any[]>(src: T, out: T) => {
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
      const sourceRuleset: Ruleset = await createRandomRuleset();
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
