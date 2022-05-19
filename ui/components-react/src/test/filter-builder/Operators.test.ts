/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import { FilterRuleOperator, filterRuleOperatorNeedsValue, getAvailableOperators } from "../../components-react/filter-builder/Operators";

chai.use(chaiSubset);

describe("getAvailableOperators", () => {
  it("returns operators by type", () => {
    expect(getAvailableOperators({name: "prop", displayLabel: "Prop", typename: "boolean"})).to.containSubset([
      FilterRuleOperator.IsTrue,
      FilterRuleOperator.IsFalse,
    ]);
    expect(getAvailableOperators({name: "prop", displayLabel: "Prop", typename: "string"})).to.containSubset([
      FilterRuleOperator.IsEqual,
      FilterRuleOperator.IsNotEqual,
      FilterRuleOperator.IsNull,
      FilterRuleOperator.IsNotNull,
      FilterRuleOperator.Like,
    ]);
    expect(getAvailableOperators({name: "prop", displayLabel: "Prop", typename: "int"})).to.containSubset([
      FilterRuleOperator.IsEqual,
      FilterRuleOperator.IsNotEqual,
      FilterRuleOperator.IsNull,
      FilterRuleOperator.IsNotNull,
      FilterRuleOperator.Greater,
      FilterRuleOperator.GreaterOrEqual,
      FilterRuleOperator.Less,
      FilterRuleOperator.LessOrEqual,
    ]);
    expect(getAvailableOperators({name: "prop", displayLabel: "Prop", typename: "long"})).to.containSubset([
      FilterRuleOperator.IsEqual,
      FilterRuleOperator.IsNotEqual,
      FilterRuleOperator.IsNull,
      FilterRuleOperator.IsNotNull,
      FilterRuleOperator.Greater,
      FilterRuleOperator.GreaterOrEqual,
      FilterRuleOperator.Less,
      FilterRuleOperator.LessOrEqual,
    ]);
    expect(getAvailableOperators({name: "prop", displayLabel: "Prop", typename: "double"})).to.containSubset([
      FilterRuleOperator.IsEqual,
      FilterRuleOperator.IsNotEqual,
      FilterRuleOperator.IsNull,
      FilterRuleOperator.IsNotNull,
      FilterRuleOperator.Greater,
      FilterRuleOperator.GreaterOrEqual,
      FilterRuleOperator.Less,
      FilterRuleOperator.LessOrEqual,
    ]);
    expect(getAvailableOperators({name: "prop", displayLabel: "Prop", typename: "dateTime"})).to.containSubset([
      FilterRuleOperator.IsEqual,
      FilterRuleOperator.IsNotEqual,
      FilterRuleOperator.IsNull,
      FilterRuleOperator.IsNotNull,
    ]);
    expect(getAvailableOperators({name: "prop", displayLabel: "Prop", typename: "otherType"})).to.containSubset([
      FilterRuleOperator.IsEqual,
      FilterRuleOperator.IsNotEqual,
      FilterRuleOperator.IsNull,
      FilterRuleOperator.IsNotNull,
    ]);
  });
});

describe("filterRuleOperatorNeedsValue", () => {
  it("returns correct values", () => {
    expect(filterRuleOperatorNeedsValue(FilterRuleOperator.IsTrue)).to.be.false;
    expect(filterRuleOperatorNeedsValue(FilterRuleOperator.IsFalse)).to.be.false;
    expect(filterRuleOperatorNeedsValue(FilterRuleOperator.IsNull)).to.be.false;
    expect(filterRuleOperatorNeedsValue(FilterRuleOperator.IsNotNull)).to.be.false;
    expect(filterRuleOperatorNeedsValue(FilterRuleOperator.IsEqual)).to.be.true;
    expect(filterRuleOperatorNeedsValue(FilterRuleOperator.IsNotEqual)).to.be.true;
    expect(filterRuleOperatorNeedsValue(FilterRuleOperator.Greater)).to.be.true;
    expect(filterRuleOperatorNeedsValue(FilterRuleOperator.GreaterOrEqual)).to.be.true;
    expect(filterRuleOperatorNeedsValue(FilterRuleOperator.Less)).to.be.true;
    expect(filterRuleOperatorNeedsValue(FilterRuleOperator.LessOrEqual)).to.be.true;
    expect(filterRuleOperatorNeedsValue(FilterRuleOperator.Like)).to.be.true;
  });
});
