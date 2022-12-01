/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import * as React from "react";
import sinon from "sinon";
import { PropertyDescription, PropertyValueFormat } from "@itwin/appui-abstract";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { buildPropertyFilter, PropertyFilterBuilder } from "../../components-react/filter-builder/FilterBuilder";
import { PropertyFilterBuilderRule, PropertyFilterBuilderRuleGroup } from "../../components-react/filter-builder/FilterBuilderState";
import { PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator } from "../../components-react/filter-builder/Operators";
import TestUtils from "../TestUtils";
import { PropertyFilter } from "../../components-react/filter-builder/Types";

chai.use(chaiSubset);

describe("PropertyFilterBuilder", () => {
  const property1: PropertyDescription = {
    name: "propertyField1",
    displayLabel: "Prop1",
    typename: "boolean",
  };
  const property2: PropertyDescription = {
    name: "propertyField2",
    displayLabel: "Prop2",
    typename: "string",
  };

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  it("call onFilterChanged with filter after new rule is setup", async () => {
    const spy = sinon.spy();
    const { container, getByText, getByDisplayValue } = render(<PropertyFilterBuilder properties={[property1]} onFilterChanged={spy} />);
    const propertySelector = container.querySelector<HTMLInputElement>(".rule-property .iui-input");
    expect(propertySelector).to.not.be.null;
    propertySelector?.focus();
    fireEvent.click(getByText("Prop1"));
    // wait until property is selected
    await waitFor(() => getByDisplayValue("Prop1"));

    expect(spy).to.be.calledOnceWith({
      property: property1,
      operator: 0,
      value: undefined,
    });
  });

  it("renders propertyFilterBuilder with single rule correctly", async () => {
    const propertyFilter: PropertyFilter = {
      property: property1,
      operator: PropertyFilterRuleOperator.IsNull,
      value: undefined,
    };
    const spy = sinon.spy();
    const { container, queryByDisplayValue } = render(<PropertyFilterBuilder properties={[property1]} onFilterChanged={spy} initialFilter={propertyFilter} />);

    const rules = container.querySelectorAll(".rule-property");
    expect(rules.length).to.be.eq(1);
    const rule1 = queryByDisplayValue(property1.displayLabel);
    expect(rule1).to.not.be.null;
  });

  it("renders propertyFilterBuilder with multiple rules correctly", async () => {
    const propertyFilter: PropertyFilter = {
      operator: PropertyFilterRuleGroupOperator.And,
      rules: [{
        operator: PropertyFilterRuleGroupOperator.And,
        rules: [{
          property: property1,
          operator: PropertyFilterRuleOperator.IsTrue,
          value: undefined,
        },
        {
          property: property2,
          operator: PropertyFilterRuleOperator.IsNull,
          value: undefined,
        }],
      }],
    };
    const spy = sinon.spy();
    const { container, queryByDisplayValue } = render(<PropertyFilterBuilder properties={[property1, property2]} onFilterChanged={spy} initialFilter={propertyFilter} />);

    const rules = container.querySelectorAll(".rule-property");
    expect(rules.length).to.be.eq(2);
    const rule1 = queryByDisplayValue(property1.displayLabel);
    expect(rule1).to.not.be.null;
    const rule2 = queryByDisplayValue(property2.displayLabel);
    expect(rule2).to.not.be.null;
  });

  it("marks rule group as active on mouse over", () => {
    const spy = sinon.spy();
    const { container } = render(<PropertyFilterBuilder properties={[]} onFilterChanged={spy} />);

    const group = container.querySelector(".rule-group");
    expect(group).to.not.be.null;

    expect(container.querySelector(".rule-group[data-isactive=true]")).to.be.null;

    fireEvent.mouseOver(group!);
    expect(container.querySelector(".rule-group[data-isactive=true]")).to.not.be.null;

    fireEvent.mouseOut(group!);
    expect(container.querySelector(".rule-group[data-isactive=true]")).to.be.null;
  });

  it("marks rule group as active on focus", () => {
    const spy = sinon.spy();
    const { container } = render(<PropertyFilterBuilder properties={[]} onFilterChanged={spy} />);

    const group = container.querySelector(".rule-group");
    expect(group).to.not.be.null;

    expect(container.querySelector(".rule-group[data-isactive=true]")).to.be.null;

    fireEvent.focus(group!);
    expect(container.querySelector(".rule-group[data-isactive=true]")).to.not.be.null;

    fireEvent.blur(group!);
    expect(container.querySelector(".rule-group[data-isactive=true]")).to.be.null;
  });

  it("keeps rule group marked as active when focus moves to other element inside group", () => {
    const spy = sinon.spy();
    const { container } = render(<PropertyFilterBuilder properties={[]} onFilterChanged={spy} />);

    const group = container.querySelector(".rule-group");
    expect(group).to.not.be.null;

    expect(container.querySelector(".rule-group[data-isactive=true]")).to.be.null;

    fireEvent.focus(group!);
    expect(container.querySelector(".rule-group[data-isactive=true]")).to.not.be.null;

    const rule = container.querySelector(".rule");
    expect(rule).to.not.be.null;

    fireEvent.blur(group!, { relatedTarget: rule });
    expect(container.querySelector(".rule-group[data-isactive=true]")).to.not.be.null;
  });

  describe("buildPropertyFilter", () => {
    const defaultRule: PropertyFilterBuilderRule = {
      id: "rule",
      groupId: "rootGroup",
      property: { name: "prop", displayLabel: "Prop", typename: "string" },
      operator: PropertyFilterRuleOperator.IsEqual,
      value: { valueFormat: PropertyValueFormat.Primitive, value: "test string" },
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
        value: { valueFormat: PropertyValueFormat.Array, items: [], itemsTypeName: "arrayType" },
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

