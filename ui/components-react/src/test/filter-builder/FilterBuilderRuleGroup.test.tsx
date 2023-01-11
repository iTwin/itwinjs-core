/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import { PropertyDescription } from "@itwin/appui-abstract";
import {
  PropertyFilterBuilderRuleGroupRenderer, PropertyFilterBuilderRuleGroupRendererProps,
} from "../../components-react/filter-builder/FilterBuilderRuleGroup";
import { PropertyFilterBuilderActions, PropertyFilterBuilderRuleGroup } from "../../components-react/filter-builder/FilterBuilderState";
import { PropertyFilterRuleGroupOperator } from "../../components-react/filter-builder/Operators";
import TestUtils from "../TestUtils";
import { renderWithContext } from "./Common";

describe("PropertyFilterBuilderRuleGroupRenderer", () => {
  const rootGroup: PropertyFilterBuilderRuleGroup = {
    id: "id",
    items: [{
      id: "child1",
      groupId: "id",
    }, {
      id: "child2",
      groupId: "id",
    }],
    operator: PropertyFilterRuleGroupOperator.And,
  };
  const defaultProps: PropertyFilterBuilderRuleGroupRendererProps = {
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
    const { queryByTestId } = renderWithContext(<PropertyFilterBuilderRuleGroupRenderer {...defaultProps} />);

    expect(queryByTestId("rule-group-remove")).to.be.null;
  });

  it("renders remove button for non root group", () => {
    const { getByTestId } = renderWithContext(<PropertyFilterBuilderRuleGroupRenderer
      {...defaultProps}
      group={{ id: "id", groupId: "parentId", items: [], operator: PropertyFilterRuleGroupOperator.And }}
    />);
    getByTestId("rule-group-remove");
  });

  it("does not render add group button if depth limit is reached", () => {
    const { queryByTestId } = renderWithContext(<PropertyFilterBuilderRuleGroupRenderer
      {...defaultProps}
      path={["parentId", "id"]}
      group={{ id: "id", groupId: "parentId", items: [], operator: PropertyFilterRuleGroupOperator.And }}
    />, { ruleGroupDepthLimit: 1 });
    expect(queryByTestId("rule-group-add-rule-group")).to.be.null;
  });

  it("does not render operator selector if only one rule is in group", () => {
    const { queryByText } = renderWithContext(<PropertyFilterBuilderRuleGroupRenderer
      {...defaultProps}
      group={{ id: "id", items: [{ id: "childId", groupId: "id" }], operator: PropertyFilterRuleGroupOperator.And }}
    />);
    expect(queryByText(TestUtils.i18n.getLocalizedString("Components:filterBuilder.operators.or"))).to.be.null;
  });

  it("renders child rule", () => {
    const property: PropertyDescription = { displayLabel: "Prop", name: "prop", typename: "int" };
    const { getByDisplayValue } = renderWithContext(<PropertyFilterBuilderRuleGroupRenderer
      {...defaultProps}
      group={{
        id: "id",
        operator: PropertyFilterRuleGroupOperator.And,
        items: [{
          id: "childId",
          groupId: "id",
          property,
        }],
      }}
    />, { properties: [property] });

    getByDisplayValue("Prop");
  });

  it("renders child rule group", () => {
    const property: PropertyDescription = { displayLabel: "Prop", name: "prop", typename: "int" };
    const { getByText } = renderWithContext(<PropertyFilterBuilderRuleGroupRenderer
      {...defaultProps}
      group={{
        id: "id",
        operator: PropertyFilterRuleGroupOperator.And,
        items: [{
          id: "childId",
          groupId: "id",
          operator: PropertyFilterRuleGroupOperator.Or,
          items: [{
            id: "grandChildId1",
            groupId: "childId",
            property,
          }, {
            id: "grandChildId2",
            groupId: "childId",
            property,
          }],
        }],
      }}
    />);

    getByText(TestUtils.i18n.getLocalizedString("Components:filterBuilder.operators.or"));
  });

  it("dispatches add rule event when button is clicked", () => {
    const actions = new PropertyFilterBuilderActions(sinon.spy());
    const { getByTestId } = renderWithContext(<PropertyFilterBuilderRuleGroupRenderer
      {...defaultProps}
    />, { actions });
    const addItemSpy = sinon.stub(actions, "addItem");

    const addRuleButton = getByTestId("rule-group-add-rule");
    addRuleButton.click();

    expect(addItemSpy).to.be.calledOnceWith(defaultProps.path, "RULE");
  });

  it("dispatches add rule group event when button is clicked", () => {
    const actions = new PropertyFilterBuilderActions(sinon.spy());
    const { getByTestId } = renderWithContext(<PropertyFilterBuilderRuleGroupRenderer
      {...defaultProps}
    />, { actions });
    const addItemSpy = sinon.stub(actions, "addItem");

    const addRuleGroupButton = getByTestId("rule-group-add-rule-group");
    addRuleGroupButton.click();

    expect(addItemSpy).to.be.calledOnceWith(defaultProps.path, "RULE_GROUP");
  });

  it("dispatches remove item event when button is clicked", () => {
    const actions = new PropertyFilterBuilderActions(sinon.spy());
    const { getByTestId } = renderWithContext(<PropertyFilterBuilderRuleGroupRenderer
      {...defaultProps}
      group={{
        id: "id",
        groupId: "parentGroupId",
        operator: PropertyFilterRuleGroupOperator.And,
        items: [],
      }}
    />, { actions });
    const removeItemSpy = sinon.stub(actions, "removeItem");

    const removeButton = getByTestId("rule-group-remove");
    removeButton.click();

    expect(removeItemSpy).to.be.calledOnceWith(defaultProps.path);
  });

  it("dispatches operator change event when operator is selected", () => {
    const actions = new PropertyFilterBuilderActions(sinon.spy());
    const { container, getByText } = renderWithContext(<PropertyFilterBuilderRuleGroupRenderer
      {...defaultProps}
    />, { actions });
    const setRuleGroupOperatorSpy = sinon.stub(actions, "setRuleGroupOperator");

    const selector = container.querySelector<HTMLInputElement>(".rule-group-operator .iui-select-button");
    expect(selector).to.not.be.null;

    selector?.click();

    getByText(TestUtils.i18n.getLocalizedString("Components:filterBuilder.operators.or")).click();

    expect(setRuleGroupOperatorSpy).to.be.calledOnceWith(defaultProps.path, PropertyFilterRuleGroupOperator.Or);
  });
});
