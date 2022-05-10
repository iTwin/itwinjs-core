/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { FilterRuleGroupOperator, FilterRuleOperator } from "../../components-react/instanceFilter/Operators";
import { isFilterConditionGroup } from "../../components-react/instanceFilter/Types";

describe("isFilterConditionGroup", () => {
  it("returns correct values", () => {
    expect(isFilterConditionGroup({operator: FilterRuleGroupOperator.And, conditions: []})).to.be.true;
    expect(isFilterConditionGroup({
      property: {name: "prop", displayLabel: "Prop", typename: "string"},
      operator: FilterRuleOperator.IsNull}
    )).to.be.false;
  });
});
