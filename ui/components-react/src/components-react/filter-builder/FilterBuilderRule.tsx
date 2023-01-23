/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyFilterBuilder
 */

import * as React from "react";
import { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import { SvgDelete } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { PropertyFilterBuilderContext, PropertyFilterBuilderRuleRenderingContext } from "./FilterBuilder";
import { PropertyFilterBuilderRuleOperator } from "./FilterBuilderRuleOperator";
import { PropertyFilterBuilderRuleProperty } from "./FilterBuilderRuleProperty";
import { PropertyFilterBuilderRuleValue } from "./FilterBuilderRuleValue";
import { PropertyFilterBuilderRule } from "./FilterBuilderState";
import { isUnaryPropertyFilterOperator, PropertyFilterRuleOperator } from "./Operators";
import "./FilterBuilderRule.scss";

/**
 * Props for [[PropertyFilterBuilderRuleRenderer]] component.
 * @beta
 */
export interface PropertyFilterBuilderRuleRendererProps {
  /** Path from [[PropertyFilterBuilder]] root to this rule. */
  path: string[];
  /** Rule to render. */
  rule: PropertyFilterBuilderRule;
}

/**
 * Component that renders single rule in [[PropertyFilterBuilder]] component.
 * @beta
 */
export function PropertyFilterBuilderRuleRenderer(props: PropertyFilterBuilderRuleRendererProps) {
  const { path, rule } = props;
  const { properties, actions, onRulePropertySelected } = React.useContext(PropertyFilterBuilderContext);
  const { ruleOperatorRenderer, ruleValueRenderer, propertyRenderer, isDisabled } = React.useContext(PropertyFilterBuilderRuleRenderingContext);
  const { property, operator, value } = rule;

  const onSelectedPropertyChanged = React.useCallback((newProperty?: PropertyDescription) => {
    actions.setRuleProperty(path, newProperty);
    // invoke 'onRulePropertySelected' when new property is selected. There is no way to deselect property
    // so 'newProperty' will be 'undefined' only if selected property is no longer in 'properties' list.
    if (onRulePropertySelected && newProperty)
      onRulePropertySelected(newProperty);
  }, [path, onRulePropertySelected, actions]);

  const onRuleOperatorChange = React.useCallback((newOperator: PropertyFilterRuleOperator) => {
    actions.setRuleOperator(path, newOperator);
  }, [path, actions]);

  const onRuleValueChange = React.useCallback((newValue: PropertyValue) => {
    actions.setRuleValue(path, newValue);
  }, [path, actions]);

  const removeRule = () => actions.removeItem(path);

  const operatorRenderer = React.useCallback((prop: PropertyDescription) => {
    if (ruleOperatorRenderer)
      return ruleOperatorRenderer({ property: prop, operator, onChange: onRuleOperatorChange });
    return <PropertyFilterBuilderRuleOperator property={prop} onChange={onRuleOperatorChange} operator={operator} />;
  }, [operator, ruleOperatorRenderer, onRuleOperatorChange]);

  const valueRenderer = React.useCallback((prop: PropertyDescription) => {
    if (ruleValueRenderer)
      return ruleValueRenderer({ property: prop, value, onChange: onRuleValueChange });
    return <PropertyFilterBuilderRuleValue property={prop} onChange={onRuleValueChange} value={value} />;
  }, [value, ruleValueRenderer, onRuleValueChange]);

  return <div className="rule">
    <div className="rule-remove-action">
      <IconButton onClick={removeRule} styleType="borderless" size="small">
        <SvgDelete />
      </IconButton>
    </div>
    <div className="rule-condition">
      <PropertyFilterBuilderRuleProperty
        properties={properties}
        selectedProperty={rule.property}
        onSelectedPropertyChanged={onSelectedPropertyChanged}
        propertyRenderer={propertyRenderer}
        isDisabled={isDisabled}
      />
      {property && operatorRenderer(property)}
      {property && operator && !isUnaryPropertyFilterOperator(operator) && valueRenderer(property)}
    </div>
  </div>;
}
