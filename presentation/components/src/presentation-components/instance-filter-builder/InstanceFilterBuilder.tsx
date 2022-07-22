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
import { PropertyFilter, PropertyFilterBuilder } from "@itwin/components-react";
import { Label } from "@itwin/itwinui-react";
import { ClassInfo } from "@itwin/presentation-common";
import { translate } from "../common/Utils";
import { MultiTagSelect } from "./MultiTagSelect";
import "./InstanceFilterBuilder.scss";

/** @alpha */
export interface InstanceFilterBuilderProps {
  selectedClasses: ClassInfo[];
  classes: ClassInfo[];
  properties: PropertyDescription[];
  onFilterChanged: (filter?: PropertyFilter) => void;
  onClassSelected: (selectedClass: ClassInfo) => void;
  onClassDeselected: (selectedClass: ClassInfo) => void;
  onClearClasses: () => void;
  onPropertySelected?: (property: PropertyDescription) => void;
  ruleGroupDepthLimit?: number;
}

/** @alpha */
export function InstanceFilterBuilder(props: InstanceFilterBuilderProps) {
  const { selectedClasses, classes, properties, ruleGroupDepthLimit, onFilterChanged, onPropertySelected, onClassSelected, onClassDeselected, onClearClasses } = props;

  const onSelectChange = React.useCallback((_, action: ActionMeta<ClassInfo>) => {
    switch (action.action) {
      case "select-option":
        action.option && onClassSelected(action.option);
        break;
      case "deselect-option":
        action.option && onClassDeselected(action.option);
        break;
      case "remove-value":
        action.removedValue && onClassDeselected(action.removedValue);
        break;
      case "clear":
        onClearClasses();
        break;
    }
  }, [onClassSelected, onClassDeselected, onClearClasses]);

  return <div className="presentation-instance-filter">
    <div className="presentation-instance-filter-class-selector">
      <Label htmlFor="class-combo-input">
        {translate("instance-filter-builder.classes")}
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
    <PropertyFilterBuilder
      properties={properties}
      onFilterChanged={onFilterChanged}
      onRulePropertySelected={onPropertySelected}
      ruleGroupDepthLimit={ruleGroupDepthLimit}
    />
  </div>;
}
