/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import sinon from "sinon";
import { PropertyDescription } from "@itwin/appui-abstract";
import { FilterRuleGroup } from "../../components-react/instanceFilter/FilterBuilderState";
import { FilterBuilderRuleGroup, FilterBuilderRuleGroupProps } from "../../components-react/instanceFilter/FilterRuleGroup";
import { FilterRuleGroupOperator } from "../../components-react/instanceFilter/Operators";
import { renderWithContext } from "./Common";

describe("FilterBuilderRuleGroup", () => {
  const rootGroup: FilterRuleGroup = {
    id: "id",
    items: [],
    operator: FilterRuleGroupOperator.And,
  };
  const defaultProps: FilterBuilderRuleGroupProps = {
    group: rootGroup,
    path: [],
  };

  it("does not render remove button for root group", () => {
    const {queryByTestId} = renderWithContext(<FilterBuilderRuleGroup {...defaultProps} />);

    expect(queryByTestId("rule-group-remove")).to.be.null;
  });

  it("renders remove button for non root group", () => {
    const {getByTestId} = renderWithContext(<FilterBuilderRuleGroup
      {...defaultProps}
      group={{id: "id", groupId: "parentId", items: [], operator: FilterRuleGroupOperator.And}}
    />);
    getByTestId("rule-group-remove");
  });

  it("renders child rule", () => {
    const property: PropertyDescription = {displayLabel: "Prop", name: "prop", typename: "int"};
    const {getByDisplayValue} = renderWithContext(<FilterBuilderRuleGroup
      {...defaultProps}
      group={{
        id: "id",
        operator: FilterRuleGroupOperator.And,
        items: [{
          id: "childId",
          groupId: "id",
          property,
        }],
      }}
    />, {properties: [property]});

    getByDisplayValue("Prop");
  });

  it("renders child rule group", () => {
    const {getByText} = renderWithContext(<FilterBuilderRuleGroup
      {...defaultProps}
      group={{
        id: "id",
        operator: FilterRuleGroupOperator.And,
        items: [{
          id: "childId",
          groupId: "id",
          operator: FilterRuleGroupOperator.Or,
          items: [],
        }],
      }}
    />);

    getByText("OR");
  });

  it("dispatches add rule event when button is clicked", () => {
    const dispatchSpy = sinon.spy();
    const {getByTestId} = renderWithContext(<FilterBuilderRuleGroup
      {...defaultProps}
    />, {dispatch: dispatchSpy});

    const addRuleButton = getByTestId("rule-group-add-rule");
    addRuleButton.click();

    expect(dispatchSpy).to.be.calledOnceWith({type: "ADD_ITEM", itemType: "RULE", path: defaultProps.path});
  });

  it("dispatches add rule group event when button is clicked", () => {
    const dispatchSpy = sinon.spy();
    const {getByTestId} = renderWithContext(<FilterBuilderRuleGroup
      {...defaultProps}
    />, {dispatch: dispatchSpy});

    const addRuleGroupButton = getByTestId("rule-group-add-rule-group");
    addRuleGroupButton.click();

    expect(dispatchSpy).to.be.calledOnceWith({type: "ADD_ITEM", itemType: "RULE_GROUP", path: defaultProps.path});
  });

  it("dispatches remove item event when button is clicked", () => {
    const dispatchSpy = sinon.spy();
    const {getByTestId} = renderWithContext(<FilterBuilderRuleGroup
      {...defaultProps}
      group={{
        id: "id",
        groupId: "parentGroupId",
        operator: FilterRuleGroupOperator.And,
        items: [],
      }}
    />, {dispatch: dispatchSpy});

    const removeButton = getByTestId("rule-group-remove");
    removeButton.click();

    expect(dispatchSpy).to.be.calledOnceWith({type: "REMOVE_ITEM", path: defaultProps.path});
  });

  it("dispatches operator change event when operator is selected", () => {
    const dispatchSpy = sinon.spy();
    const {container, getByText} = renderWithContext(<FilterBuilderRuleGroup
      {...defaultProps}
    />, {dispatch: dispatchSpy});

    const selector = container.querySelector<HTMLInputElement>(".rule-group-operator .iui-select-button");
    expect(selector).to.not.be.null;

    selector?.click();

    getByText("OR").click();

    expect(dispatchSpy).to.be.calledOnceWith({type: "SET_RULE_GROUP_OPERATOR", path: defaultProps.path, operator: FilterRuleGroupOperator.Or});
  });
});
