/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */

import * as React from "react";
import { ActionMeta } from "react-select";
import { PropertyDescription } from "@itwin/appui-abstract";
import { Filter, FilterBuilder } from "@itwin/components-react";
import { Label } from "@itwin/itwinui-react";
import { ClassInfo } from "@itwin/presentation-common";
import { MultiTagSelect } from "./MultiTagSelect";
import "./InstanceFilterBuilder.scss";

/** @alpha */
export interface InstanceFilterBuilderProps {
  selectedClasses: ClassInfo[];
  classes: ClassInfo[];
  properties: PropertyDescription[];
  onFilterChanged: (filter?: Filter) => void;
  onClassSelected: (selectedClass: ClassInfo) => void;
  onClassDeSelected: (selectedClass: ClassInfo) => void;
  onClearClasses: () => void;
  onPropertySelected?: (property: PropertyDescription) => void;
}

/** @alpha */
export function InstanceFilterBuilder(props: InstanceFilterBuilderProps) {
  const {selectedClasses, classes, properties, onFilterChanged, onPropertySelected, onClassSelected, onClassDeSelected, onClearClasses} = props;

  const onSelectChange = React.useCallback((_, action: ActionMeta<ClassInfo>) => {
    switch (action.action) {
      case "select-option":
        action.option && onClassSelected(action.option);
        break;
      case "deselect-option":
        action.option && onClassDeSelected(action.option);
        break;
      case "remove-value":
        action.removedValue && onClassDeSelected(action.removedValue);
        break;
      case "clear":
        onClearClasses();
        break;
    }
  }, [onClassSelected, onClassDeSelected, onClearClasses]);

  return <div className="presentation-instance-filter">
    <div className="presentation-instance-filter-class-selector">
      <Label htmlFor="class-combo-input">
        Classes
      </Label>
      <MultiTagSelect
        id="class-combo-input"
        options={classes}
        value={selectedClasses}
        onChange={onSelectChange}
        getOptionLabel={(option) => option.label}
        getOptionValue={(option) => option.id}
        hideSelectedOptions={false}
        closeMenuOnSelect={false}
        isClearable={true}
      />
    </div>
    <FilterBuilder properties={properties} onFilterChanged={onFilterChanged} onRulePropertySelected={onPropertySelected}/>
  </div>;
}
