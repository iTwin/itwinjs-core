/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Primitives, PropertyDescription, PropertyRecord, PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { EditorContainer, PropertyUpdatedArgs } from "../editors/EditorContainer";

/** @alpha */
export interface FilterBuilderRuleValueProps {
  value?: PropertyValue;
  property: PropertyDescription;
  onChange: (value: PropertyValue) => void;
}

/** @alpha */
export function FilterBuilderRuleValue(props: FilterBuilderRuleValueProps) {
  const {value, property, onChange} = props;

  const propertyRecord = React.useMemo(() => {
    return new PropertyRecord(value ?? createDefaultPropertyValue(property), property);
  }, [value, property]);

  const onValueChange = React.useCallback(({newValue}: PropertyUpdatedArgs) => {
    onChange(newValue);
  }, [onChange]);

  return <EditorContainer
    propertyRecord={propertyRecord}
    onCancel={() => {}}
    onCommit={onValueChange}
    setFocus={false}
  />;
}

function createDefaultPropertyValue(property: PropertyDescription): PropertyValue {
  const typename = property.typename.toLowerCase();

  let value: Primitives.Value | undefined;
  if (typename === "date" || typename === "datetime") {
    value = new Date();
  }

  return {
    valueFormat: PropertyValueFormat.Primitive,
    value,
  };
}
