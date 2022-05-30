/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription } from "@itwin/appui-abstract";
import { Select } from "@itwin/itwinui-react";
import { getPropertyFilterOperatorLabel, getPropertyFilterOperators, PropertyFilterRuleOperator } from "./Operators";

/** @alpha */
export interface PropertyFilterBuilderRuleOperatorProps {
  operator?: PropertyFilterRuleOperator;
  property: PropertyDescription;
  onChange: (operator: PropertyFilterRuleOperator) => void;
}

/** @alpha */
export function PropertyFilterBuilderRuleOperator(props: PropertyFilterBuilderRuleOperatorProps) {
  const {operator, property, onChange} = props;

  const availableOperators = React.useMemo(() => getPropertyFilterOperators(property), [property]);
  const selectedOperator = operator ?? availableOperators[0];

  React.useEffect(() => {
    if (!operator)
      onChange(selectedOperator);
  }, [operator, onChange, selectedOperator]);

  const availableOptions = React.useMemo(() => availableOperators.map((op) => ({
    value: op,
    label: getPropertyFilterOperatorLabel(op),
  })), [availableOperators]);

  return <div className="rule-operator">
    <Select options={availableOptions} value={selectedOperator} onChange={onChange} size="small"/>
  </div>;
}
