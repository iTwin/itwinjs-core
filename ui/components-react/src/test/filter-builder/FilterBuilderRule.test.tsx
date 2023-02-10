/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import { PropertyDescription, PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { fireEvent } from "@testing-library/react";
import {
  PropertyFilterBuilderRuleRenderer, PropertyFilterBuilderRuleRendererProps,
} from "../../components-react/filter-builder/FilterBuilderRule";
import { PropertyFilterBuilderRuleOperatorProps } from "../../components-react/filter-builder/FilterBuilderRuleOperator";
import { PropertyFilterBuilderRuleValueProps } from "../../components-react/filter-builder/FilterBuilderRuleValue";
import { PropertyFilterBuilderActions } from "../../components-react/filter-builder/FilterBuilderState";
import { PropertyFilterRuleOperator } from "../../components-react/filter-builder/Operators";
import TestUtils from "../TestUtils";
import { renderWithContext } from "./Common";

describe("PropertyFilterBuilderRuleRenderer", () => {
  const defaultProps: PropertyFilterBuilderRuleRendererProps = {
    path: [],
    rule: { id: "id", groupId: "groupId" },
  };
  const defaultProperty: PropertyDescription = {
    displayLabel: "Prop",
    name: "prop",
    typename: "int",
  };

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  describe("rule operator", () => {
    it("does not render operator if rule property is undefined", () => {
      const { container } = renderWithContext(<PropertyFilterBuilderRuleRenderer {...defaultProps} />);

      const operatorContainer = container.querySelector<HTMLDivElement>(".rule-operator");
      expect(operatorContainer).to.be.null;
    });

    it("renders operator if rule property is defined", () => {
      const { container } = renderWithContext(<PropertyFilterBuilderRuleRenderer {...defaultProps} rule={{ ...defaultProps.rule, property: defaultProperty }} />);

      const operatorContainer = container.querySelector<HTMLDivElement>(".rule-operator");
      expect(operatorContainer).to.not.be.null;
    });

    it("renders operator using provided renderer", () => {
      const spy = sinon.spy();
      renderWithContext(<PropertyFilterBuilderRuleRenderer {...defaultProps} rule={{ ...defaultProps.rule, property: defaultProperty }} />, {}, { ruleOperatorRenderer: spy });

      expect(spy).to.be.calledOnce;
    });
  });

  describe("rule value", () => {
    it("does not render value if rule property is undefined", () => {
      const { container } = renderWithContext(<PropertyFilterBuilderRuleRenderer {...defaultProps} />);

      const valueContainer = container.querySelector<HTMLDivElement>(".rule-value");
      expect(valueContainer).to.be.null;
    });

    it("does not render value if rule operator is undefined", () => {
      const { container } = renderWithContext(<PropertyFilterBuilderRuleRenderer {...defaultProps} rule={{ ...defaultProps.rule, property: defaultProperty }} />);

      const valueContainer = container.querySelector<HTMLDivElement>(".rule-value");
      expect(valueContainer).to.be.null;
    });

    it("renders value when value and operator defined", () => {
      const { container } = renderWithContext(<PropertyFilterBuilderRuleRenderer
        {...defaultProps}
        rule={{ ...defaultProps.rule, property: defaultProperty, operator: PropertyFilterRuleOperator.IsEqual }}
      />);

      const valueContainer = container.querySelector<HTMLDivElement>(".rule-value");
      expect(valueContainer).to.not.be.null;
      expect(valueContainer!.hasChildNodes()).to.be.true;
    });

    it("renders operator using provided renderer", () => {
      const spy = sinon.spy();
      renderWithContext(<PropertyFilterBuilderRuleRenderer
        {...defaultProps}
        rule={{ ...defaultProps.rule, property: defaultProperty, operator: PropertyFilterRuleOperator.IsEqual }}
      />, {}, { ruleValueRenderer: spy });

      expect(spy).to.be.calledOnce;
    });
  });

  describe("rule property", () => {
    it("renders with property renderer", () => {
      const actions = new PropertyFilterBuilderActions(sinon.spy());
      const propertyRendererSpy = sinon.spy();
      const { container } = renderWithContext(<PropertyFilterBuilderRuleRenderer {...defaultProps} />,
        { actions, properties: [defaultProperty] }, { propertyRenderer: propertyRendererSpy });

      // open property selector menu
      const selector = container.querySelector<HTMLInputElement>(".rule-property input");
      expect(selector).to.not.be.null;
      fireEvent.focus(selector!);

      expect(propertyRendererSpy).to.be.calledWith(defaultProperty.name);
    });

    it("opens property selector menu", () => {
      const actions = new PropertyFilterBuilderActions(sinon.spy());
      const { container, queryByText } = renderWithContext(
        <PropertyFilterBuilderRuleRenderer {...defaultProps} />,
        { actions, properties: [defaultProperty] },
      );

      // open property selector
      const selector = container.querySelector<HTMLInputElement>(".rule-property input");
      expect(selector).to.not.be.null;
      fireEvent.focus(selector!);

      expect(queryByText(defaultProperty.displayLabel)).to.not.be.null;
    });

    it("does not open property selector menu when property selection is disabled", () => {
      const actions = new PropertyFilterBuilderActions(sinon.spy());
      const { container, queryByText } = renderWithContext(
        <PropertyFilterBuilderRuleRenderer {...defaultProps} />,
        { actions, properties: [defaultProperty] },
        { isDisabled: true }
      );

      // attempt to open property selector
      const selector = container.querySelector<HTMLInputElement>(".rule-property input");
      expect(selector).to.not.be.null;
      fireEvent.focus(selector!);

      expect(queryByText(defaultProperty.displayLabel)).to.be.null;
    });
  });

  it("dispatches property change when property is selected", () => {
    const actions = new PropertyFilterBuilderActions(sinon.spy());
    const { container, getByText } = renderWithContext(<PropertyFilterBuilderRuleRenderer {...defaultProps} />, { actions, properties: [defaultProperty] });
    const setRulePropertySpy = sinon.stub(actions, "setRuleProperty");

    const selector = container.querySelector<HTMLInputElement>(".rule-property input");
    expect(selector).to.not.be.null;
    fireEvent.focus(selector!);

    fireEvent.click(getByText(defaultProperty.displayLabel));
    expect(setRulePropertySpy).to.be.calledOnceWith(defaultProps.path, defaultProperty);
  });

  it("dispatches property change with undefined property when selected property is not in properties list", () => {
    const actions = new PropertyFilterBuilderActions(sinon.spy());
    const setRulePropertySpy = sinon.stub(actions, "setRuleProperty");
    renderWithContext(<PropertyFilterBuilderRuleRenderer
      {...defaultProps}
      rule={{ ...defaultProps.rule, property: defaultProperty, operator: PropertyFilterRuleOperator.IsEqual }}
    />, { actions, properties: [] });

    expect(setRulePropertySpy).to.be.calledOnceWith(defaultProps.path, undefined);
  });

  it("invokes onRulePropertySelected callback when property is selected", () => {
    const spy = sinon.spy();
    const { container, getByText } = renderWithContext(<PropertyFilterBuilderRuleRenderer {...defaultProps} />, { properties: [defaultProperty], onRulePropertySelected: spy });

    const selector = container.querySelector<HTMLInputElement>(".rule-property input");
    expect(selector).to.not.be.null;
    fireEvent.focus(selector!);

    fireEvent.click(getByText(defaultProperty.displayLabel));
    expect(spy).to.be.calledOnceWith(defaultProperty);
  });

  it("dispatches remove rule action", () => {
    const actions = new PropertyFilterBuilderActions(sinon.spy());
    const { container } = renderWithContext(<PropertyFilterBuilderRuleRenderer {...defaultProps} />, { actions });
    const removeItemSpy = sinon.stub(actions, "removeItem");

    const button = container.querySelector(".rule-remove-action")?.firstElementChild;
    expect(button).to.not.be.null;
    fireEvent.click(button!);
    expect(removeItemSpy).to.be.calledOnceWith(defaultProps.path);
  });

  it("dispatches operator change when operator is changed", () => {
    const actions = new PropertyFilterBuilderActions(sinon.spy());
    const operatorRendererSpy = sinon.spy();
    renderWithContext(<PropertyFilterBuilderRuleRenderer
      {...defaultProps}
      rule={{ ...defaultProps.rule, property: defaultProperty, operator: PropertyFilterRuleOperator.IsEqual }}
    />, { actions }, { ruleOperatorRenderer: operatorRendererSpy });
    const setRuleOperatorSpy = sinon.stub(actions, "setRuleOperator");

    expect(operatorRendererSpy).to.be.calledOnce;
    const operatorRendererProps = operatorRendererSpy.firstCall.args[0] as PropertyFilterBuilderRuleOperatorProps;
    const newOperator = PropertyFilterRuleOperator.IsNotNull;
    operatorRendererProps.onChange(newOperator);

    expect(setRuleOperatorSpy).to.be.calledOnceWith(defaultProps.path, newOperator);
  });

  it("dispatches value change when value is changed", () => {
    const actions = new PropertyFilterBuilderActions(sinon.spy());
    const valueRendererSpy = sinon.spy();
    renderWithContext(<PropertyFilterBuilderRuleRenderer
      {...defaultProps}
      rule={{ ...defaultProps.rule, property: defaultProperty, operator: PropertyFilterRuleOperator.IsEqual }}
    />, { actions }, { ruleValueRenderer: valueRendererSpy });
    const setRuleValueSpy = sinon.stub(actions, "setRuleValue");

    expect(valueRendererSpy).to.be.calledOnce;
    const valueRendererProps = valueRendererSpy.firstCall.args[0] as PropertyFilterBuilderRuleValueProps;
    const newValue: PropertyValue = { valueFormat: PropertyValueFormat.Primitive };
    valueRendererProps.onChange(newValue);

    expect(setRuleValueSpy).to.be.calledOnceWith(defaultProps.path, newValue);
  });
});
