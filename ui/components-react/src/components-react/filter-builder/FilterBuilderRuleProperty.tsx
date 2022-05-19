/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription } from "@itwin/appui-abstract";
import { ComboBox } from "@itwin/itwinui-react";

/** @alpha */
export interface FilterBuilderRulePropertyProps {
  properties: PropertyDescription[];
  selectedProperty?: PropertyDescription;
  onSelectedPropertyChanged: (property?: PropertyDescription) => void;
}

/** @alpha */
export function FilterBuilderRuleProperty(props: FilterBuilderRulePropertyProps) {
  const { selectedProperty, properties, onSelectedPropertyChanged } = props;

  const selectOptions = React.useMemo(() => properties.map((property) => ({
    label: property.displayLabel,
    value: property.name,
  })), [properties]);

  const onPropertyChanged = React.useCallback((name: string) => {
    const newProperty = properties.find((property) => property.name === name);
    onSelectedPropertyChanged(newProperty);
  }, [properties, onSelectedPropertyChanged]);

  React.useEffect(() => {
    const currentSelectedProperty = properties.find((property) => property.name === selectedProperty?.name);
    if (currentSelectedProperty?.name !== selectedProperty?.name)
      onSelectedPropertyChanged(currentSelectedProperty);
  }, [properties, selectedProperty, onSelectedPropertyChanged]);

  return <div className="rule-property">
    <ComboBox
      options={selectOptions}
      onChange={onPropertyChanged}
      value={selectedProperty?.name}
    />
  </div>;
}
