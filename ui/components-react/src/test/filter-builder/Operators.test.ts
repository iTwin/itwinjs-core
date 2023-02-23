/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import {
  getPropertyFilterOperators, isUnaryPropertyFilterOperator, PropertyFilterRuleOperator,
} from "../../components-react/filter-builder/Operators";

chai.use(chaiSubset);

describe("getPropertyFilterOperators", () => {
  it("returns operators by type", () => {
    expect(getPropertyFilterOperators({ name: "prop", displayLabel: "Prop", typename: "boolean" })).to.containSubset([
      PropertyFilterRuleOperator.IsTrue,
      PropertyFilterRuleOperator.IsFalse,
    ]);
    expect(getPropertyFilterOperators({ name: "prop", displayLabel: "Prop", typename: "string" })).to.containSubset([
      PropertyFilterRuleOperator.IsEqual,
      PropertyFilterRuleOperator.IsNotEqual,
      PropertyFilterRuleOperator.IsNull,
      PropertyFilterRuleOperator.IsNotNull,
      PropertyFilterRuleOperator.Like,
    ]);
    expect(getPropertyFilterOperators({ name: "prop", displayLabel: "Prop", typename: "int" })).to.containSubset([
      PropertyFilterRuleOperator.IsEqual,
      PropertyFilterRuleOperator.IsNotEqual,
      PropertyFilterRuleOperator.IsNull,
      PropertyFilterRuleOperator.IsNotNull,
      PropertyFilterRuleOperator.Greater,
      PropertyFilterRuleOperator.GreaterOrEqual,
      PropertyFilterRuleOperator.Less,
      PropertyFilterRuleOperator.LessOrEqual,
    ]);
    expect(getPropertyFilterOperators({ name: "prop", displayLabel: "Prop", typename: "double" })).to.containSubset([
      PropertyFilterRuleOperator.IsEqual,
      PropertyFilterRuleOperator.IsNotEqual,
      PropertyFilterRuleOperator.IsNull,
      PropertyFilterRuleOperator.IsNotNull,
      PropertyFilterRuleOperator.Greater,
      PropertyFilterRuleOperator.GreaterOrEqual,
      PropertyFilterRuleOperator.Less,
      PropertyFilterRuleOperator.LessOrEqual,
    ]);
    expect(getPropertyFilterOperators({ name: "prop", displayLabel: "Prop", typename: "dateTime" })).to.containSubset([
      PropertyFilterRuleOperator.IsEqual,
      PropertyFilterRuleOperator.IsNotEqual,
      PropertyFilterRuleOperator.IsNull,
      PropertyFilterRuleOperator.IsNotNull,
      PropertyFilterRuleOperator.Greater,
      PropertyFilterRuleOperator.GreaterOrEqual,
      PropertyFilterRuleOperator.Less,
      PropertyFilterRuleOperator.LessOrEqual,
    ]);
    expect(getPropertyFilterOperators({ name: "prop", displayLabel: "Prop", typename: "otherType" })).to.containSubset([
      PropertyFilterRuleOperator.IsEqual,
      PropertyFilterRuleOperator.IsNotEqual,
      PropertyFilterRuleOperator.IsNull,
      PropertyFilterRuleOperator.IsNotNull,
    ]);
  });
});

describe("isUnaryPropertyFilterOperator", () => {
  it("returns correct values", () => {
    expect(isUnaryPropertyFilterOperator(PropertyFilterRuleOperator.IsTrue)).to.be.true;
    expect(isUnaryPropertyFilterOperator(PropertyFilterRuleOperator.IsFalse)).to.be.true;
    expect(isUnaryPropertyFilterOperator(PropertyFilterRuleOperator.IsNull)).to.be.true;
    expect(isUnaryPropertyFilterOperator(PropertyFilterRuleOperator.IsNotNull)).to.be.true;
    expect(isUnaryPropertyFilterOperator(PropertyFilterRuleOperator.IsEqual)).to.be.false;
    expect(isUnaryPropertyFilterOperator(PropertyFilterRuleOperator.IsNotEqual)).to.be.false;
    expect(isUnaryPropertyFilterOperator(PropertyFilterRuleOperator.Greater)).to.be.false;
    expect(isUnaryPropertyFilterOperator(PropertyFilterRuleOperator.GreaterOrEqual)).to.be.false;
    expect(isUnaryPropertyFilterOperator(PropertyFilterRuleOperator.Less)).to.be.false;
    expect(isUnaryPropertyFilterOperator(PropertyFilterRuleOperator.LessOrEqual)).to.be.false;
    expect(isUnaryPropertyFilterOperator(PropertyFilterRuleOperator.Like)).to.be.false;
  });
});
