/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import deepEqual from "deep-equal";
import type { Rule} from "@itwin/presentation-common";
import { PropertyGroupingValue, RuleTypes } from "@itwin/presentation-common";

const rulesOrder = [
  RuleTypes.RootNodes, RuleTypes.ChildNodes,
  RuleTypes.Content, RuleTypes.ContentModifier,
  RuleTypes.ImageIdOverride, RuleTypes.InstanceLabelOverride, RuleTypes.LabelOverride,
  RuleTypes.StyleOverride, RuleTypes.Grouping, RuleTypes.CheckBox,
  RuleTypes.DisabledSorting, RuleTypes.PropertySorting,
];
const specialDefaultValues = new Map<string, any>([
  ["condition", ""],
  ["createGroupForUnspecifiedValues", true],
  ["groupingValue", PropertyGroupingValue.DisplayLabel],
  ["isExclude", false],
  ["propertyName", ""],
  ["schemaNames", []],
  ["sortingValue", PropertyGroupingValue.DisplayLabel],
  ["sortAscending", true],
  ["vars", []],
]);

const hasIndexSignature = (o: any): o is { [key: string]: string } => {
  return typeof o === "object";
};

const valueMatchesDefault = (key: string, value: any): boolean => {
  if (false === value) {
    return true;
  }
  if (specialDefaultValues.has(key)) {
    const defaultValue = specialDefaultValues.get(key);
    return deepEqual(value, defaultValue) || (typeof defaultValue === "object");
  }
  return false;
};

export const tweakRuleset = <T extends { [key: string]: any } | any[]>(src: T, out: T) => {
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
        if (undefined === out[key] && undefined !== src[key]) {
          if (valueMatchesDefault(key, srcValue))
            out[key as keyof T] = srcValue;
        }
        if (typeof srcValue === "object" || Array.isArray(srcValue)) {
          tweakRuleset(srcValue, out[key]);
        }
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`Source: \r\n${JSON.stringify(src)} \r\nTarget: \r\n${JSON.stringify(out)}`);
    throw e;
  }
};
