/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */

import * as React from "react";
import { ActionMeta } from "react-select";
import { PropertyFilter, PropertyFilterBuilder, PropertyFilterBuilderProps } from "@itwin/components-react";
import { ClassInfo } from "@itwin/presentation-common";
import { translate } from "../common/Utils";
import { MultiTagSelect } from "./MultiTagSelect";
import "./InstanceFilterBuilder.scss";

/**
 * Props for [[InstanceFilterBuilder]] component.
 * @beta
 */
export interface InstanceFilterBuilderProps extends PropertyFilterBuilderProps {
  /** Currently selected classes. */
  selectedClasses: ClassInfo[];
  /** List of all available classes. */
  classes: ClassInfo[];
  /** Callback that is invoked when filter is changed. */
  onFilterChanged: (filter?: PropertyFilter) => void;
  /** Callback that is invoked when class is selected. */
  onClassSelected: (selectedClass: ClassInfo) => void;
  /** Callback that is invoked when class is de-selected. */
  onClassDeselected: (selectedClass: ClassInfo) => void;
  /** Callback that is invoked when all selected classes are cleared. */
  onClearClasses: () => void;
}

/**
 * Component for building complex instance filters based on instance properties. In addition to filter builder component
 * it renders selector for classes that can be used to filter out available properties in filter rules.
 * @beta
 */
export function InstanceFilterBuilder(props: InstanceFilterBuilderProps) {
  const { selectedClasses, classes, onClassSelected, onClassDeselected, onClearClasses, ...restProps } = props;

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
      <MultiTagSelect
        id="class-combo-input"
        placeholder={translate("instance-filter-builder.select-class")}
        options={classes}
        value={selectedClasses}
        onChange={onSelectChange}
        getOptionLabel={(option) => option.label}
        getOptionValue={(option) => option.id}
        hideSelectedOptions={false}
        closeMenuOnSelect={false}
        isClearable={true}
        isDisabled={restProps.isDisabled}
      />
    </div>
    <div className="presentation-property-filter-builder">
      <PropertyFilterBuilder
        {...restProps}
      />
    </div>
  </div>;
}
