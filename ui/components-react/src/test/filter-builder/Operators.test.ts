/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import {
  getPropertyFilterOperators, propertyFilterOperatorNeedsValue, PropertyFilterRuleOperator,
} from "../../components-react/filter-builder/Operators";

chai.use(chaiSubset);

describe("getPropertyFilterOperators", () => {
  it("returns operators by type", () => {
    expect(getPropertyFilterOperators({name: "prop", displayLabel: "Prop", typename: "boolean"})).to.containSubset([
      PropertyFilterRuleOperator.IsTrue,
      PropertyFilterRuleOperator.IsFalse,
    ]);
    expect(getPropertyFilterOperators({name: "prop", displayLabel: "Prop", typename: "string"})).to.containSubset([
      PropertyFilterRuleOperator.IsEqual,
      PropertyFilterRuleOperator.IsNotEqual,
      PropertyFilterRuleOperator.IsNull,
      PropertyFilterRuleOperator.IsNotNull,
      PropertyFilterRuleOperator.Like,
    ]);
    expect(getPropertyFilterOperators({name: "prop", displayLabel: "Prop", typename: "int"})).to.containSubset([
      PropertyFilterRuleOperator.IsEqual,
      PropertyFilterRuleOperator.IsNotEqual,
      PropertyFilterRuleOperator.IsNull,
      PropertyFilterRuleOperator.IsNotNull,
      PropertyFilterRuleOperator.Greater,
      PropertyFilterRuleOperator.GreaterOrEqual,
      PropertyFilterRuleOperator.Less,
      PropertyFilterRuleOperator.LessOrEqual,
    ]);
    expect(getPropertyFilterOperators({name: "prop", displayLabel: "Prop", typename: "double"})).to.containSubset([
      PropertyFilterRuleOperator.IsEqual,
      PropertyFilterRuleOperator.IsNotEqual,
      PropertyFilterRuleOperator.IsNull,
      PropertyFilterRuleOperator.IsNotNull,
      PropertyFilterRuleOperator.Greater,
      PropertyFilterRuleOperator.GreaterOrEqual,
      PropertyFilterRuleOperator.Less,
      PropertyFilterRuleOperator.LessOrEqual,
    ]);
    expect(getPropertyFilterOperators({name: "prop", displayLabel: "Prop", typename: "dateTime"})).to.containSubset([
      PropertyFilterRuleOperator.IsEqual,
      PropertyFilterRuleOperator.IsNotEqual,
      PropertyFilterRuleOperator.IsNull,
      PropertyFilterRuleOperator.IsNotNull,
      PropertyFilterRuleOperator.Greater,
      PropertyFilterRuleOperator.GreaterOrEqual,
      PropertyFilterRuleOperator.Less,
      PropertyFilterRuleOperator.LessOrEqual,
    ]);
    expect(getPropertyFilterOperators({name: "prop", displayLabel: "Prop", typename: "otherType"})).to.containSubset([
      PropertyFilterRuleOperator.IsEqual,
      PropertyFilterRuleOperator.IsNotEqual,
      PropertyFilterRuleOperator.IsNull,
      PropertyFilterRuleOperator.IsNotNull,
    ]);
  });
});

describe("filterRuleOperatorNeedsValue", () => {
  it("returns correct values", () => {
    expect(propertyFilterOperatorNeedsValue(PropertyFilterRuleOperator.IsTrue)).to.be.false;
    expect(propertyFilterOperatorNeedsValue(PropertyFilterRuleOperator.IsFalse)).to.be.false;
    expect(propertyFilterOperatorNeedsValue(PropertyFilterRuleOperator.IsNull)).to.be.false;
    expect(propertyFilterOperatorNeedsValue(PropertyFilterRuleOperator.IsNotNull)).to.be.false;
    expect(propertyFilterOperatorNeedsValue(PropertyFilterRuleOperator.IsEqual)).to.be.true;
    expect(propertyFilterOperatorNeedsValue(PropertyFilterRuleOperator.IsNotEqual)).to.be.true;
    expect(propertyFilterOperatorNeedsValue(PropertyFilterRuleOperator.Greater)).to.be.true;
    expect(propertyFilterOperatorNeedsValue(PropertyFilterRuleOperator.GreaterOrEqual)).to.be.true;
    expect(propertyFilterOperatorNeedsValue(PropertyFilterRuleOperator.Less)).to.be.true;
    expect(propertyFilterOperatorNeedsValue(PropertyFilterRuleOperator.LessOrEqual)).to.be.true;
    expect(propertyFilterOperatorNeedsValue(PropertyFilterRuleOperator.Like)).to.be.true;
  });
});
