/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription, PropertyRecord, PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { EditorContainer, PropertyUpdatedArgs } from "../editors/EditorContainer";

/**
 * Props for [[PropertyFilterBuilderRuleValue]] component.
 * @beta
 */
export interface PropertyFilterBuilderRuleValueProps {
  /** Currently entered value. */
  value?: PropertyValue;
  /** Property used in rule to which this value will be compared to. */
  property: PropertyDescription;
  /** Callback that is invoked when value changes. */
  onChange: (value: PropertyValue) => void;
}

/**
 * Component that renders [[PropertyFilterBuilderRuleRenderer]] value input.
 * @beta
 */
export function PropertyFilterBuilderRuleValue(props: PropertyFilterBuilderRuleValueProps) {
  const { value, property, onChange } = props;

  const propertyRecord = React.useMemo(() => {
    return new PropertyRecord(value ?? { valueFormat: PropertyValueFormat.Primitive }, property);
  }, [value, property]);

  const onValueChange = React.useCallback(({ newValue }: PropertyUpdatedArgs) => {
    onChange(newValue);
  }, [onChange]);

  return <div className="rule-value">
    <EditorContainer
      propertyRecord={propertyRecord}
      onCancel={/* istanbul ignore next */ () => { }}
      onCommit={onValueChange}
      setFocus={false}
    />
  </div>;
}
