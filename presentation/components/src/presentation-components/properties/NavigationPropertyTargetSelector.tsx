/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import classnames from "classnames";
import * as React from "react";
import {
  components, ControlProps, IndicatorContainerProps, IndicatorProps, MenuProps, OptionProps, OptionTypeBase, ValueContainerProps,
} from "react-select";
import { AsyncPaginate } from "react-select-async-paginate";
import { PropertyRecord, PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { PropertyEditorProps } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import { SvgCaretDownSmall } from "@itwin/itwinui-icons-react";
import { NavigationPropertyInfo } from "@itwin/presentation-common";
import { translate } from "../common/Utils";
import {
  NavigationPropertyTarget, useNavigationPropertyTargetsLoader, useNavigationPropertyTargetsRuleset,
} from "./UseNavigationPropertyTargetsLoader";

export interface NavigationPropertyTargetSelectorAttributes {
  getValue: () => PropertyValue | undefined;
  divElement: HTMLDivElement | null;
}

export interface NavigationPropertyTargetSelectorProps extends PropertyEditorProps {
  imodel: IModelConnection;
  getNavigationPropertyInfo: (record: PropertyRecord) => Promise<NavigationPropertyInfo | undefined>;
}

export const NavigationPropertyTargetSelector = React.forwardRef<NavigationPropertyTargetSelectorAttributes, NavigationPropertyTargetSelectorProps>((props, ref) => {
  const { imodel, getNavigationPropertyInfo, propertyRecord, onCommit, setFocus } = props;
  const divRef = React.useRef<HTMLDivElement>(null);
  const targetsRuleset = useNavigationPropertyTargetsRuleset(getNavigationPropertyInfo, propertyRecord);
  const loadTargets = useNavigationPropertyTargetsLoader({ imodel, ruleset: targetsRuleset });

  const [selectedTarget, setSelectedTarget] = React.useState<NavigationPropertyTarget | undefined>();

  const onChange = React.useCallback((target?: NavigationPropertyTarget) => {
    setSelectedTarget(target);
    target && propertyRecord && onCommit && onCommit({ propertyRecord, newValue: getPropertyValue(target) });
  }, [propertyRecord, onCommit]);

  React.useImperativeHandle(ref,
    () => ({
      getValue: () => getPropertyValue(selectedTarget),
      divElement: divRef.current,
    }),
    [selectedTarget]
  );

  return <div ref={divRef}>
    <AsyncPaginate
      isMulti={false}
      onChange={onChange}
      loadOptions={loadTargets}
      getOptionLabel={(option: NavigationPropertyTarget) => option.label.displayValue}
      getOptionValue={(option: NavigationPropertyTarget) => option.key.id}
      hideSelectedOptions={false}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus={setFocus}
      value={selectedTarget}
      debounceTimeout={500}
      placeholder={<>{translate("navigation-property-editor.select-target-instance")}</>}
      loadingMessage={() => translate("navigation-property-editor.loading-target-instances")}
      styles={{
        control: () => ({ height: "27px" }),
        valueContainer: () => ({ height: "27px" }),
        menu: () => ({ position: "absolute", zIndex: 9999 }),
        option: () => ({ whiteSpace: "nowrap" }),
      }}
      components={{
        Control: TargetSelectControl,
        ValueContainer: TargetSelectValueContainer,
        Menu: TargetSelectMenu,
        Option: TargetSelectOption,
        IndicatorsContainer: TargetSelectIndicatorsContainer,
        DropdownIndicator: TargetSelectDropdownIndicator,
      }}
    />
  </div>;
});
NavigationPropertyTargetSelector.displayName = "NavigationPropertyTargetSelector";

function getPropertyValue(target?: NavigationPropertyTarget): PropertyValue {
  return { valueFormat: PropertyValueFormat.Primitive, value: target?.key };
}

function TargetSelectControl<TOption extends OptionTypeBase>({ children, ...props }: ControlProps<TOption>) {
  return <components.Control {...props} className="iui-input-with-icon" >
    {children}
  </components.Control>;
}

function TargetSelectValueContainer<TOption extends OptionTypeBase>({ children, ...props }: ValueContainerProps<TOption>) {
  return <components.ValueContainer {...props} className="iui-select-button iui-small" >
    {children}
  </components.ValueContainer>;
}

function TargetSelectMenu<TOption extends OptionTypeBase>({ children, ...props }: MenuProps<TOption>) {
  return <components.Menu {...props} className="iui-menu" >
    {children}
  </components.Menu>;
}

function TargetSelectOption<TOption extends OptionTypeBase>({ children: _, ...props }: OptionProps<TOption>) {
  const className = classnames("iui-menu-item", {
    "iui-focused": props.isFocused,
    "iui-active": props.isSelected,
  });

  return <components.Option {...props} className={className} >
    <span>{props.selectProps.getOptionLabel && props.selectProps.getOptionLabel(props.data)} </span>
  </components.Option>;
}

function TargetSelectIndicatorsContainer<TOption extends OptionTypeBase>({ children }: IndicatorContainerProps<TOption>) {
  return React.Children.toArray(children).pop();
}

function TargetSelectDropdownIndicator<TOption extends OptionTypeBase>(_: IndicatorProps<TOption>) {
  return <span className="iui-end-icon iui-actionable" >
    <SvgCaretDownSmall />
  </span>;
}
