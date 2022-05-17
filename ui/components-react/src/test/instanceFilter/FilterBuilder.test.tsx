/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import sinon from "sinon";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import { render } from "@testing-library/react";
import { buildFilter, FilterBuilder } from "../../components-react/instanceFilter/FilterBuilder";
import { FilterRule, FilterRuleGroup } from "../../components-react/instanceFilter/FilterBuilderState";
import { FilterRuleGroupOperator, FilterRuleOperator } from "../../components-react/instanceFilter/Operators";
import TestUtils from "../TestUtils";

chai.use(chaiSubset);

describe("FilterBuilder", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  it("call onFilterChanged with empty filter if rule is not setup", () => {
    const spy = sinon.spy();
    render(<FilterBuilder properties={[]} onFilterChanged={spy} />);
    expect(spy).to.be.calledOnceWith(undefined);
  });

  describe("buildFilter", () => {
    const defaultRule: FilterRule = {
      id: "rule",
      groupId: "rootGroup",
      property: {name: "prop", displayLabel: "Prop", typename: "string"},
      operator: FilterRuleOperator.IsEqual,
      value: {valueFormat: PropertyValueFormat.Primitive, value: "test string"},
    };

    it("returns undefined when rule does not have property", () => {
      const rule: FilterRule = {
        ...defaultRule,
        property: undefined,
      };
      expect(buildFilter(rule)).to.be.undefined;
    });

    it("returns undefined when rule does not have operator", () => {
      const rule: FilterRule = {
        ...defaultRule,
        operator: undefined,
      };
      expect(buildFilter(rule)).to.be.undefined;
    });

    it("returns undefined when rule does not have value and operator requires value", () => {
      const rule: FilterRule = {
        ...defaultRule,
        value: undefined,
      };
      expect(buildFilter(rule)).to.be.undefined;
    });

    it("returns undefined when rule has non primitive value", () => {
      const rule: FilterRule = {
        ...defaultRule,
        value: {valueFormat: PropertyValueFormat.Array, items: [], itemsTypeName: "arrayType"},
      };
      expect(buildFilter(rule)).to.be.undefined;
    });

    it("returns undefined when group has no rules", () => {
      const ruleGroup: FilterRuleGroup = {
        id: "rootGroup",
        operator: FilterRuleGroupOperator.And,
        items: [],
      };
      expect(buildFilter(ruleGroup)).to.be.undefined;
    });

    it("returns single filter condition when group has one rule", () => {
      const ruleGroup: FilterRuleGroup = {
        id: "rootGroup",
        operator: FilterRuleGroupOperator.And,
        items: [defaultRule],
      };
      expect(buildFilter(ruleGroup)).to.containSubset({
        operator: defaultRule.operator,
        property: defaultRule.property,
        value: defaultRule.value,
      });
    });

    it("returns filter conditions group when group has multiple rules", () => {
      const ruleGroup: FilterRuleGroup = {
        id: "rootGroup",
        operator: FilterRuleGroupOperator.Or,
        items: [defaultRule, defaultRule],
      };
      const filter = buildFilter(ruleGroup);
      const expectedFilter = {
        operator: ruleGroup.operator,
        conditions: [{
          property: defaultRule.property,
          operator: defaultRule.operator,
          value: defaultRule.value,
        }, {
          property: defaultRule.property,
          operator: defaultRule.operator,
          value: defaultRule.value,
        }],
      };
      expect(filter).to.containSubset(expectedFilter);
    });
  });
});

