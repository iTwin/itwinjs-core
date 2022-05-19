/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { FilterRuleGroupOperator, FilterRuleOperator } from "../../components-react/filter-builder/Operators";
import { isFilterRuleGroup } from "../../components-react/filter-builder/Types";

describe("isFilterRuleGroup", () => {
  it("returns correct values", () => {
    expect(isFilterRuleGroup({operator: FilterRuleGroupOperator.And, rules: []})).to.be.true;
    expect(isFilterRuleGroup({
      property: {name: "prop", displayLabel: "Prop", typename: "string"},
      operator: FilterRuleOperator.IsNull}
    )).to.be.false;
  });
});
