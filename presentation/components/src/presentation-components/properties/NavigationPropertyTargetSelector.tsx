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
import { PropertyDescription, PropertyRecord, PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { PropertyEditorProps, PropertyValueRendererManager } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import { SvgCaretDownSmall } from "@itwin/itwinui-icons-react";
import { InstanceKey, LabelDefinition, NavigationPropertyInfo } from "@itwin/presentation-common";
import { translate } from "../common/Utils";
import {
  NavigationPropertyTarget, useNavigationPropertyTargetsLoader, useNavigationPropertyTargetsRuleset,
} from "./UseNavigationPropertyTargetsLoader";

/** @internal */
export interface NavigationPropertyTargetSelectorAttributes {
  getValue: () => PropertyValue | undefined;
  divElement: HTMLDivElement | null;
}

/** @internal */
export interface NavigationPropertyTargetSelectorProps extends PropertyEditorProps {
  imodel: IModelConnection;
  getNavigationPropertyInfo: (property: PropertyDescription) => Promise<NavigationPropertyInfo | undefined>;
  propertyRecord: PropertyRecord;
}

/** @internal */
export const NavigationPropertyTargetSelector = React.forwardRef<NavigationPropertyTargetSelectorAttributes, NavigationPropertyTargetSelectorProps>((props, ref) => {
  const { imodel, getNavigationPropertyInfo, propertyRecord, onCommit, setFocus } = props;
  const divRef = React.useRef<HTMLDivElement>(null);
  const targetsRuleset = useNavigationPropertyTargetsRuleset(getNavigationPropertyInfo, propertyRecord.property);
  const loadTargets = useNavigationPropertyTargetsLoader({ imodel, ruleset: targetsRuleset });

  const [selectedTarget, setSelectedTarget] = React.useState(() => getNavigationTargetFromPropertyRecord(propertyRecord));

  const onChange = React.useCallback((target?: NavigationPropertyTarget) => {
    setSelectedTarget(target);
    target && onCommit && onCommit({ propertyRecord, newValue: getPropertyValue(target) });
  }, [propertyRecord, onCommit]);

  React.useImperativeHandle(ref,
    () => ({
      getValue: () => getPropertyValue(selectedTarget),
      divElement: divRef.current,
    }),
    [selectedTarget]
  );

  React.useEffect(() => {
    setSelectedTarget(getNavigationTargetFromPropertyRecord(propertyRecord));
  }, [propertyRecord]);

  if (!targetsRuleset)
    return <ReadonlyNavigationPropertyTarget record={props.propertyRecord} />;

  return <div ref={divRef}>
    <AsyncPaginate
      isMulti={false}
      onChange={onChange}
      value={selectedTarget ?? null}
      getOptionLabel={(option: NavigationPropertyTarget) => option.label.displayValue}
      getOptionValue={(option: NavigationPropertyTarget) => option.key.id}
      hideSelectedOptions={false}
      debounceTimeout={500}
      loadOptions={loadTargets}
      cacheUniqs={[loadTargets]}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus={setFocus}
      placeholder={<>{translate("navigation-property-editor.select-target-instance")}</>}
      loadingMessage={() => translate("navigation-property-editor.loading-target-instances")}
      styles={{
        control: () => ({ height: "27px" }),
        container: () => ({ width: "auto" }),
        valueContainer: () => ({ height: "27px" }),
        menu: () => ({ width: "auto", position: "absolute", zIndex: 9999 }),
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

/** @internal */
export interface ReadonlyNavigationPropertyTargetProps {
  record: PropertyRecord;
}

/** @internal */
export function ReadonlyNavigationPropertyTarget(props: ReadonlyNavigationPropertyTargetProps) {
  const { record } = props;
  return <>{PropertyValueRendererManager.defaultManager.render(record)}</>;
}

function getPropertyValue(target?: NavigationPropertyTarget): PropertyValue {
  return { valueFormat: PropertyValueFormat.Primitive, value: target?.key, displayValue: target?.label.displayValue };
}

function getNavigationTargetFromPropertyRecord(record: PropertyRecord): NavigationPropertyTarget | undefined {
  const value = record.value;
  if (value.valueFormat !== PropertyValueFormat.Primitive || !value.value || !value.displayValue)
    return undefined;

  return { key: value.value as InstanceKey, label: LabelDefinition.fromLabelString(value.displayValue) };
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
