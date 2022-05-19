/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription } from "@itwin/appui-abstract";
import { Select } from "@itwin/itwinui-react";
import { FilterRuleOperator, getAvailableOperators, getFilterRuleOperatorLabel } from "./Operators";

/** @alpha */
export interface FilterBuilderRuleOperatorProps {
  operator?: FilterRuleOperator;
  property: PropertyDescription;
  onChange: (operator: FilterRuleOperator) => void;
}

/** @alpha */
export function FilterBuilderRuleOperator(props: FilterBuilderRuleOperatorProps) {
  const {operator, property, onChange} = props;

  const availableOperators = React.useMemo(() => getAvailableOperators(property), [property]);
  const selectedOperator = operator ?? availableOperators[0];

  React.useEffect(() => {
    if (!operator)
      onChange(selectedOperator);
  }, [operator, onChange, selectedOperator]);

  const availableOptions = React.useMemo(() => availableOperators.map((op) => ({
    value: op,
    label: getFilterRuleOperatorLabel(op),
  })), [availableOperators]);

  return <div className="rule-operator">
    <Select options={availableOptions} value={selectedOperator} onChange={onChange} size="small"/>
  </div>;
}
