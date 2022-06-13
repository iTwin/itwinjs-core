/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription } from "@itwin/appui-abstract";
import { ComboBox, SelectOption } from "@itwin/itwinui-react";
import { UiComponents } from "../UiComponents";

/** @alpha */
export interface PropertyFilterBuilderRulePropertyProps {
  properties: PropertyDescription[];
  selectedProperty?: PropertyDescription;
  onSelectedPropertyChanged: (property?: PropertyDescription) => void;
}

/** @alpha */
export function PropertyFilterBuilderRuleProperty(props: PropertyFilterBuilderRulePropertyProps) {
  const { selectedProperty, properties, onSelectedPropertyChanged } = props;

  const selectOptions = React.useMemo<SelectOption<string>[]>(() => properties.map((property) => ({
    id: property.name,
    label: property.displayLabel,
    value: property.name,
  })), [properties]);

  const onPropertyChanged = React.useCallback((name: string) => {
    onSelectedPropertyChanged(properties.find((property) => property.name === name));
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
      inputProps={{
        placeholder: UiComponents.translate("filterBuilder.chooseProperty"),
      }}
    />
  </div>;
}
