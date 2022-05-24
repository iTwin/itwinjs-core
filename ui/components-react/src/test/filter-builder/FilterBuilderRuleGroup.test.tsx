/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import { PropertyDescription } from "@itwin/appui-abstract";
import { FilterBuilderRuleGroupRenderer, FilterBuilderRuleGroupRendererProps } from "../../components-react/filter-builder/FilterBuilderRuleGroup";
import { FilterBuilderRuleGroup } from "../../components-react/filter-builder/FilterBuilderState";
import { FilterRuleGroupOperator } from "../../components-react/filter-builder/Operators";
import TestUtils from "../TestUtils";
import { renderWithContext } from "./Common";

describe("<FilterBuilderRuleGroupRenderer", () => {
  const rootGroup: FilterBuilderRuleGroup = {
    id: "id",
    items: [],
    operator: FilterRuleGroupOperator.And,
  };
  const defaultProps: FilterBuilderRuleGroupRendererProps = {
    group: rootGroup,
    path: [],
  };

  beforeEach(async () => {
    await TestUtils.initializeUiComponents();
  });

  afterEach(() => {
    TestUtils.terminateUiComponents();
  });

  it("does not render remove button for root group", () => {
    const {queryByTestId} = renderWithContext(<FilterBuilderRuleGroupRenderer {...defaultProps} />);

    expect(queryByTestId("rule-group-remove")).to.be.null;
  });

  it("renders remove button for non root group", () => {
    const {getByTestId} = renderWithContext(<FilterBuilderRuleGroupRenderer
      {...defaultProps}
      group={{id: "id", groupId: "parentId", items: [], operator: FilterRuleGroupOperator.And}}
    />);
    getByTestId("rule-group-remove");
  });

  it("renders child rule", () => {
    const property: PropertyDescription = {displayLabel: "Prop", name: "prop", typename: "int"};
    const {getByDisplayValue} = renderWithContext(<FilterBuilderRuleGroupRenderer
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
    const {getByText} = renderWithContext(<FilterBuilderRuleGroupRenderer
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

    getByText(TestUtils.i18n.getLocalizedString("Components:filterBuilder.operators.or"));
  });

  it("dispatches add rule event when button is clicked", () => {
    const dispatchSpy = sinon.spy();
    const {getByTestId} = renderWithContext(<FilterBuilderRuleGroupRenderer
      {...defaultProps}
    />, {dispatch: dispatchSpy});

    const addRuleButton = getByTestId("rule-group-add-rule");
    addRuleButton.click();

    expect(dispatchSpy).to.be.calledOnceWith({type: "ADD_ITEM", itemType: "RULE", path: defaultProps.path});
  });

  it("dispatches add rule group event when button is clicked", () => {
    const dispatchSpy = sinon.spy();
    const {getByTestId} = renderWithContext(<FilterBuilderRuleGroupRenderer
      {...defaultProps}
    />, {dispatch: dispatchSpy});

    const addRuleGroupButton = getByTestId("rule-group-add-rule-group");
    addRuleGroupButton.click();

    expect(dispatchSpy).to.be.calledOnceWith({type: "ADD_ITEM", itemType: "RULE_GROUP", path: defaultProps.path});
  });

  it("dispatches remove item event when button is clicked", () => {
    const dispatchSpy = sinon.spy();
    const {getByTestId} = renderWithContext(<FilterBuilderRuleGroupRenderer
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
    const {container, getByText} = renderWithContext(<FilterBuilderRuleGroupRenderer
      {...defaultProps}
    />, {dispatch: dispatchSpy});

    const selector = container.querySelector<HTMLInputElement>(".rule-group-operator .iui-select-button");
    expect(selector).to.not.be.null;

    selector?.click();

    getByText(TestUtils.i18n.getLocalizedString("Components:filterBuilder.operators.or")).click();

    expect(dispatchSpy).to.be.calledOnceWith({type: "SET_RULE_GROUP_OPERATOR", path: defaultProps.path, operator: FilterRuleGroupOperator.Or});
  });
});
