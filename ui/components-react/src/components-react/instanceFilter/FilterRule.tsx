/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import { Button } from "@itwin/itwinui-react";
import { FilterBuilderContext, FilterBuilderRuleRenderingContext } from "./FilterBuilder";
import { FilterRule } from "./FilterBuilderState";
import { FilterBuilderPropertySelector } from "./FilterPropertySelector";
import { FilterBuilderRuleOperator } from "./FilterRuleOperator";
import { FilterBuilderRuleValue } from "./FilterRuleValue";
import { FilterRuleOperator } from "./Operators";

/** @alpha */
export interface FilterBuilderRuleProps {
  path: string[];
  rule: FilterRule;
}

/** @alpha */
export function FilterBuilderRule(props: FilterBuilderRuleProps) {
  const { path, rule} = props;
  const { properties, dispatch, onRulePropertySelected} = React.useContext(FilterBuilderContext);
  const { ruleOperatorRenderer, ruleValueRenderer} = React.useContext(FilterBuilderRuleRenderingContext);
  const { property, operator, value } = rule;

  const onSelectedPropertyChanged = React.useCallback((newProperty?: PropertyDescription) => {
    dispatch({type: "SET_RULE_PROPERTY", path, property: newProperty});
    if (newProperty)
      onRulePropertySelected(newProperty);
  }, [path, onRulePropertySelected, dispatch]);

  const onRuleOperatorChange = React.useCallback((newOperator: FilterRuleOperator) => {
    dispatch({type: "SET_RULE_OPERATOR", path, operator: newOperator});
  }, [path, dispatch]);

  const onRuleValueChange = React.useCallback((newValue: PropertyValue) => {
    dispatch({type: "SET_RULE_VALUE", path, value: newValue});
  }, [path, dispatch]);

  const onRemoveRule = () => dispatch({type: "REMOVE_ITEM", path});

  const operatorRenderer = React.useCallback(() => {
    if (!property)
      return undefined;
    if (ruleOperatorRenderer)
      return ruleOperatorRenderer({property, operator, onChange: onRuleOperatorChange});
    return <FilterBuilderRuleOperator property={property} onChange={onRuleOperatorChange} operator={operator} />;
  }, [ruleOperatorRenderer, property, operator, onRuleOperatorChange]);

  const valueRenderer = React.useCallback(() => {
    if (!property)
      return undefined;
    if (ruleValueRenderer)
      return ruleValueRenderer({property, value, onChange: onRuleValueChange});
    return <FilterBuilderRuleValue property={property} onChange={onRuleValueChange} value={value} />;
  }, [ruleValueRenderer, property, value, onRuleValueChange]);

  return <div className="rule">
    <div className="rule-condition">
      <div className="rule-field-selector">
        <FilterBuilderPropertySelector
          properties={properties}
          selectedProperty={rule.property}
          onSelectedPropertyChanged={onSelectedPropertyChanged}
        />
      </div>
      <div className="rule-operator">
        {property && operatorRenderer()}
      </div>
      <div className="rule-value">
        {property && valueRenderer()}
      </div>
    </div>
    <div className="rule-actions">
      <Button onClick={onRemoveRule} size="small">Remove Rule</Button>
    </div>
  </div>;
}
