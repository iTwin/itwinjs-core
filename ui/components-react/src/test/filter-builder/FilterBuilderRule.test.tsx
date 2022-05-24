/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import { PropertyDescription, PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { fireEvent } from "@testing-library/react";
import { FilterBuilderRuleRenderer, FilterBuilderRuleRendererProps } from "../../components-react/filter-builder/FilterBuilderRule";
import { FilterBuilderRuleOperatorProps } from "../../components-react/filter-builder/FilterBuilderRuleOperator";
import { FilterBuilderRuleValueProps } from "../../components-react/filter-builder/FilterBuilderRuleValue";
import { FilterRuleOperator } from "../../components-react/filter-builder/Operators";
import TestUtils from "../TestUtils";
import { renderWithContext } from "./Common";

describe("<FilterBuilderRuleRenderer", () => {
  const defaultProps: FilterBuilderRuleRendererProps = {
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
      const {container} = renderWithContext(<FilterBuilderRuleRenderer {...defaultProps} />);

      const operatorContainer = container.querySelector<HTMLDivElement>(".rule-operator");
      expect(operatorContainer).to.be.null;
    });

    it("renders operator if rule property is defined", () => {
      const {container} = renderWithContext(<FilterBuilderRuleRenderer {...defaultProps} rule={{...defaultProps.rule, property: defaultProperty}} />);

      const operatorContainer = container.querySelector<HTMLDivElement>(".rule-operator");
      expect(operatorContainer).to.not.be.null;
    });

    it ("renders operator using provided renderer", () => {
      const spy = sinon.spy();
      renderWithContext(<FilterBuilderRuleRenderer {...defaultProps} rule={{...defaultProps.rule, property: defaultProperty}}/>, {}, {ruleOperatorRenderer: spy});

      expect(spy).to.be.calledOnce;
    });
  });

  describe("rule value", () => {
    it("does not render value if rule property is undefined", () => {
      const {container} = renderWithContext(<FilterBuilderRuleRenderer {...defaultProps} />);

      const valueContainer = container.querySelector<HTMLDivElement>(".rule-value");
      expect(valueContainer).to.be.null;
    });

    it("does not render value if rule operator is undefined", () => {
      const {container} = renderWithContext(<FilterBuilderRuleRenderer {...defaultProps} rule={{...defaultProps.rule, property: defaultProperty}}/>);

      const valueContainer = container.querySelector<HTMLDivElement>(".rule-value");
      expect(valueContainer).to.be.null;
    });

    it("renders value when value and operator defined", () => {
      const {container} = renderWithContext(<FilterBuilderRuleRenderer
        {...defaultProps}
        rule={{...defaultProps.rule, property: defaultProperty, operator: FilterRuleOperator.IsEqual}}
      />);

      const valueContainer = container.querySelector<HTMLDivElement>(".rule-value");
      expect(valueContainer).to.not.be.null;
      expect(valueContainer!.hasChildNodes()).to.be.true;
    });

    it ("renders operator using provided renderer", () => {
      const spy = sinon.spy();
      renderWithContext(<FilterBuilderRuleRenderer
        {...defaultProps}
        rule={{...defaultProps.rule, property: defaultProperty, operator: FilterRuleOperator.IsEqual}}
      />, {}, {ruleValueRenderer: spy});

      expect(spy).to.be.calledOnce;
    });
  });

  it("dispatches property change when property is selected", () => {
    const spy = sinon.spy();
    const {container, getByText} = renderWithContext(<FilterBuilderRuleRenderer {...defaultProps} />, {dispatch: spy, properties: [defaultProperty]});

    const selector = container.querySelector<HTMLInputElement>(".rule-property .iui-input");
    expect(selector).to.not.be.null;

    selector?.focus();

    getByText(defaultProperty.displayLabel).click();

    expect(spy).to.be.calledOnceWith({type: "SET_RULE_PROPERTY", path: defaultProps.path, property: defaultProperty});
  });

  it("dispatches property change with undefined property when selected property is not in properties list", () => {
    const spy = sinon.spy();
    renderWithContext(<FilterBuilderRuleRenderer
      {...defaultProps}
      rule={{...defaultProps.rule, property: defaultProperty, operator: FilterRuleOperator.IsEqual}}
    />, {dispatch: spy, properties: []});

    expect(spy).to.be.calledOnceWith({type: "SET_RULE_PROPERTY", path: defaultProps.path, property: undefined});
  });

  it("invokes onRulePropertySelected callback when property is selected", () => {
    const spy = sinon.spy();
    const {container, getByText} = renderWithContext(<FilterBuilderRuleRenderer {...defaultProps} />, {properties: [defaultProperty], onRulePropertySelected: spy});

    const selector = container.querySelector<HTMLInputElement>(".rule-property .iui-input");
    expect(selector).to.not.be.null;

    selector?.focus();

    getByText(defaultProperty.displayLabel).click();

    expect(spy).to.be.calledOnceWith(defaultProperty);
  });

  it("dispatches remove rule action", () => {
    const spy = sinon.spy();
    const {container} = renderWithContext(<FilterBuilderRuleRenderer {...defaultProps} />, {dispatch: spy});

    const button = container.querySelector(".rule-actions")?.firstElementChild;
    expect(button).to.not.be.null;
    fireEvent.click(button!);
    expect(spy).to.be.calledOnceWith({type: "REMOVE_ITEM", path: defaultProps.path});
  });

  it("dispatches operator change when operator is changed", () => {
    const dispatchSpy = sinon.spy();
    const operatorRendererSpy = sinon.spy();
    renderWithContext(<FilterBuilderRuleRenderer
      {...defaultProps}
      rule={{...defaultProps.rule, property: defaultProperty, operator: FilterRuleOperator.IsEqual}}
    />, {dispatch: dispatchSpy}, {ruleOperatorRenderer: operatorRendererSpy});

    dispatchSpy.resetHistory();
    expect(operatorRendererSpy).to.be.calledOnce;
    const operatorRendererProps = operatorRendererSpy.firstCall.args[0] as FilterBuilderRuleOperatorProps;
    const newOperator = FilterRuleOperator.IsNotNull;
    operatorRendererProps.onChange(newOperator);

    expect(dispatchSpy).to.be.calledOnceWith({type: "SET_RULE_OPERATOR", path: defaultProps.path, operator: newOperator});
  });

  it("dispatches value change when value is changed", () => {
    const dispatchSpy = sinon.spy();
    const valueRendererSpy = sinon.spy();
    renderWithContext(<FilterBuilderRuleRenderer
      {...defaultProps}
      rule={{...defaultProps.rule, property: defaultProperty, operator: FilterRuleOperator.IsEqual}}
    />, {dispatch: dispatchSpy}, {ruleValueRenderer: valueRendererSpy});

    dispatchSpy.resetHistory();
    expect(valueRendererSpy).to.be.calledOnce;
    const valueRendererProps = valueRendererSpy.firstCall.args[0] as FilterBuilderRuleValueProps;
    const newValue: PropertyValue = {valueFormat: PropertyValueFormat.Primitive};
    valueRendererProps.onChange(newValue);

    expect(dispatchSpy).to.be.calledOnceWith({type: "SET_RULE_VALUE", path: defaultProps.path, value: newValue});
  });
});
