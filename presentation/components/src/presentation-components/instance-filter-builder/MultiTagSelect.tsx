/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import Component, {
  components, ControlProps, IndicatorProps, MenuProps, MultiValueProps, OptionProps, Props, ValueContainerProps,
} from "react-select";
import { SvgCaretDown, SvgCheckmarkSmall, SvgCloseSmall } from "@itwin/itwinui-icons-react";

/** @internal */
export function MultiTagSelect<Option>(props: Props<Option>) {
  return <Component
    {...props}
    styles={{
      control: () => ({display: "grid", gridTemplateColumns: "auto auto", height: "41px", padding: "0 12px"}),
      menu: () => ({position: "absolute", zIndex: 9999}),
      option: () => ({}),
      input: (style) => ({...style, order: -1, flex: 0}),
      valueContainer: (style) => ({...style, padding: 0, flexWrap: "nowrap"}),
      indicatorsContainer: () => ({marginLeft: "auto", display: "flex"}),
      multiValue: (style) => ({...style, margin: 0}),
    }}
    components={{
      Control: TagSelectControl,
      Menu: TagSelectMenu,
      ValueContainer: TagSelectValueContainer,
      MultiValue: TagMultiValue,
      Option: TagSelectOption,
      DropdownIndicator: TagSelectDropdownIndicator,
      ClearIndicator: TagSelectClearIndicator,
    }}
    isMulti={true}
  />;
}

function TagSelectControl<Option>({children, ...props}: ControlProps<Option>) {
  return <components.Control {...props} className="iui-select-button">
    {children}
  </components.Control>;
}

function TagSelectMenu<Option>({children, ...props}: MenuProps<Option>) {
  return <components.Menu {...props} className="iui-menu">
    {children}
  </components.Menu>;
}

function TagSelectOption<Option>({children: _, ...props}: OptionProps<Option>) {
  const className = classnames("iui-menu-item", {
    "iui-focused": props.isFocused,
    "iui-active": props.isSelected,
  });

  return <components.Option {...props} className={className}>
    <span>{props.selectProps.getOptionLabel && props.selectProps.getOptionLabel(props.data)}</span>
    {props.isSelected && <span className="iui-icon" style={{marginLeft: "auto"}}><SvgCheckmarkSmall /></span>}
  </components.Option>;
}

function TagSelectValueContainer<Option>({children, ...props}: ValueContainerProps<Option>) {
  return <components.ValueContainer {...props} className="iui-tag-container">
    {children}
  </components.ValueContainer>;
}

function TagMultiValue<Option>({children, ...props}: MultiValueProps<Option>) {
  return <components.MultiValue
    {...props}
    components={{
      Container: TagContainer,
      Label: TagLabel,
      Remove: TagRemove,
    }}
  >
    {children}
  </components.MultiValue>;
}

function TagContainer({children, ...props}: any) {
  return <components.MultiValueContainer {...props} innerProps={{...props.innerProps, className:"iui-tag"}}>
    {children}
  </components.MultiValueContainer>;
}

function TagLabel({children, ...props}: any) {
  return <components.MultiValueLabel {...props} innerProps={{...props.innerProps, className:"iui-tag-label"}}>
    {children}
  </components.MultiValueLabel>;
}

function TagRemove(props: any) {
  return <components.MultiValueRemove {...props} innerProps={{...props.innerProps, className: "iui-button iui-borderless iui-small iui-tag-button"}}>
    <SvgCloseSmall className="iui-button-icon" aria-hidden/>
  </components.MultiValueRemove>;
}

function TagSelectDropdownIndicator<Option>({children: _, ...props}: IndicatorProps<Option>) {
  return <components.DropdownIndicator {...props} >
    <span data-testid="multi-tag-select-dropdownIndicator" className="iui-end-icon iui-actionable" style={{padding: 0}}>
      <SvgCaretDown />
    </span>
  </components.DropdownIndicator>;
}

function TagSelectClearIndicator<Option>({children: _, ...props}: IndicatorProps<Option>) {
  return <components.ClearIndicator {...props} >
    <span data-testid="multi-tag-select-clearIndicator" className="iui-end-icon iui-actionable" style={{padding: 0}}>
      <SvgCloseSmall aria-hidden/>
    </span>
  </components.ClearIndicator>;
}
