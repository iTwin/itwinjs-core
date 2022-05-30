/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import * as React from "react";
import sinon from "sinon";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import { render } from "@testing-library/react";
import { buildPropertyFilter, PropertyFilterBuilder } from "../../components-react/filter-builder/FilterBuilder";
import { PropertyFilterBuilderRule, PropertyFilterBuilderRuleGroup } from "../../components-react/filter-builder/FilterBuilderState";
import { PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator } from "../../components-react/filter-builder/Operators";
import TestUtils from "../TestUtils";

chai.use(chaiSubset);

describe("PropertyFilterBuilder", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  it("call onFilterChanged with empty filter if rule is not setup", () => {
    const spy = sinon.spy();
    render(<PropertyFilterBuilder properties={[]} onFilterChanged={spy} />);
    expect(spy).to.be.calledOnceWith(undefined);
  });

  describe("buildPropertyFilter", () => {
    const defaultRule: PropertyFilterBuilderRule = {
      id: "rule",
      groupId: "rootGroup",
      property: {name: "prop", displayLabel: "Prop", typename: "string"},
      operator: PropertyFilterRuleOperator.IsEqual,
      value: {valueFormat: PropertyValueFormat.Primitive, value: "test string"},
    };

    it("returns undefined when rule does not have property", () => {
      const rule: PropertyFilterBuilderRule = {
        ...defaultRule,
        property: undefined,
      };
      expect(buildPropertyFilter(rule)).to.be.undefined;
    });

    it("returns undefined when rule does not have operator", () => {
      const rule: PropertyFilterBuilderRule = {
        ...defaultRule,
        operator: undefined,
      };
      expect(buildPropertyFilter(rule)).to.be.undefined;
    });

    it("returns undefined when rule does not have value and operator requires value", () => {
      const rule: PropertyFilterBuilderRule = {
        ...defaultRule,
        value: undefined,
      };
      expect(buildPropertyFilter(rule)).to.be.undefined;
    });

    it("returns undefined when rule has non primitive value", () => {
      const rule: PropertyFilterBuilderRule = {
        ...defaultRule,
        value: {valueFormat: PropertyValueFormat.Array, items: [], itemsTypeName: "arrayType"},
      };
      expect(buildPropertyFilter(rule)).to.be.undefined;
    });

    it("returns undefined when group has no rules", () => {
      const ruleGroup: PropertyFilterBuilderRuleGroup = {
        id: "rootGroup",
        operator: PropertyFilterRuleGroupOperator.And,
        items: [],
      };
      expect(buildPropertyFilter(ruleGroup)).to.be.undefined;
    });

    it("returns single filter condition when group has one rule", () => {
      const ruleGroup: PropertyFilterBuilderRuleGroup = {
        id: "rootGroup",
        operator: PropertyFilterRuleGroupOperator.And,
        items: [defaultRule],
      };
      expect(buildPropertyFilter(ruleGroup)).to.containSubset({
        operator: defaultRule.operator,
        property: defaultRule.property,
        value: defaultRule.value,
      });
    });

    it("returns filter conditions group when group has multiple rules", () => {
      const ruleGroup: PropertyFilterBuilderRuleGroup = {
        id: "rootGroup",
        operator: PropertyFilterRuleGroupOperator.Or,
        items: [defaultRule, defaultRule],
      };
      const filter = buildPropertyFilter(ruleGroup);
      const expectedFilter = {
        operator: ruleGroup.operator,
        rules: [{
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

