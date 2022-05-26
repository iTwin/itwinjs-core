/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import { SvgDelete } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { FilterBuilderContext, FilterBuilderRuleRenderingContext } from "./FilterBuilder";
import { FilterBuilderRuleOperator } from "./FilterBuilderRuleOperator";
import { FilterBuilderRuleProperty } from "./FilterBuilderRuleProperty";
import { FilterBuilderRuleValue } from "./FilterBuilderRuleValue";
import { FilterBuilderRule } from "./FilterBuilderState";
import { FilterRuleOperator, filterRuleOperatorNeedsValue } from "./Operators";

/** @alpha */
export interface FilterBuilderRuleRendererProps {
  path: string[];
  rule: FilterBuilderRule;
}

/** @alpha */
export function FilterBuilderRuleRenderer(props: FilterBuilderRuleRendererProps) {
  const { path, rule} = props;
  const { properties, actions, onRulePropertySelected } = React.useContext(FilterBuilderContext);
  const { ruleOperatorRenderer, ruleValueRenderer } = React.useContext(FilterBuilderRuleRenderingContext);
  const { property, operator, value } = rule;

  const onSelectedPropertyChanged = React.useCallback((newProperty?: PropertyDescription) => {
    actions.setRuleProperty(path, newProperty);
    if (onRulePropertySelected && newProperty)
      onRulePropertySelected(newProperty);
  }, [path, onRulePropertySelected, actions]);

  const onRuleOperatorChange = React.useCallback((newOperator: FilterRuleOperator) => {
    actions.setRuleOperator(path, newOperator);
  }, [path, actions]);

  const onRuleValueChange = React.useCallback((newValue: PropertyValue) => {
    actions.setRuleValue(path, newValue);
  }, [path, actions]);

  const removeRule = () => actions.removeItem(path);

  const operatorRenderer = React.useCallback((prop: PropertyDescription) => {
    if (ruleOperatorRenderer)
      return ruleOperatorRenderer({property: prop, operator, onChange: onRuleOperatorChange});
    return <FilterBuilderRuleOperator property={prop} onChange={onRuleOperatorChange} operator={operator} />;
  }, [ operator,ruleOperatorRenderer, onRuleOperatorChange]);

  const valueRenderer = React.useCallback((prop: PropertyDescription) => {
    if (ruleValueRenderer)
      return ruleValueRenderer({property: prop, value, onChange: onRuleValueChange});
    return <FilterBuilderRuleValue property={prop} onChange={onRuleValueChange} value={value} />;
  }, [value, ruleValueRenderer, onRuleValueChange]);

  return <div className="rule" tabIndex={-1}>
    <div className="rule-remove-action">
      <IconButton onClick={removeRule} styleType="borderless" size="small">
        <SvgDelete />
      </IconButton>
    </div>
    <div className="rule-condition">
      <FilterBuilderRuleProperty
        properties={properties}
        selectedProperty={rule.property}
        onSelectedPropertyChanged={onSelectedPropertyChanged}
      />
      {property && operatorRenderer(property)}
      {property && operator && filterRuleOperatorNeedsValue(operator) && valueRenderer(property)}
    </div>
  </div>;
}
