/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Select
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../utils/Props";

/** Properties for [[Select]] component
 * @public
 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement>, CommonProps {
  /** options for select dropdown.
   * @example
   * // Example of {[key: string]: string} usage:
   * <Select options={{
   *  option1: "Option 1",
   *  option2: "Option 2",
   *  option3: "Option 3",
   * }} />
   *
   * // Example of string[] usage:
   * <Select options={[
   *  "Option 1",
   *  "Option 2",
   *  "Option 3",
   * ]} />
   * }
   */
  options: string[] | { [key: string]: string };
  /** Indicates whether to set focus to the select element */
  setFocus?: boolean;
}

function getCurrentDefaultValue(defaultValue: string | undefined, placeholderValue: string | undefined) {
  if (defaultValue)
    return defaultValue;

  return placeholderValue;
}

/** Basic select component is a wrapper for the `<select>` HTML element.
 * @public
 */
export function Select(props: SelectProps) {
  const selectElement = React.useRef<HTMLSelectElement>(null);
  const placeholderValue = React.useRef("placeholder");
  const isInitialMount = React.useRef(true);

  React.useEffect(() => {
    if (props.setFocus && selectElement.current)
      selectElement.current.focus();
  }, [props]);

  React.useEffect(() => {
    isInitialMount.current = false;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { value: selectValue, required, options, setFocus, className, defaultValue, ...otherProps } = props as any; // pluck off values that will be explicitly set below
  const showPlaceholder = React.useMemo(() => props.placeholder && (!selectValue || selectValue === placeholderValue.current) && !defaultValue, [defaultValue, selectValue, props.placeholder]);
  const isRequired = React.useMemo(() => showPlaceholder || required, [required, showPlaceholder]);
  const currentDefaultValue = React.useMemo(() => getCurrentDefaultValue(defaultValue, showPlaceholder ? placeholderValue.current : undefined), [defaultValue, showPlaceholder]);

  return (
    <select ref={selectElement} {...otherProps}
      required={isRequired}
      className={classnames("uicore-inputs-select", className)}
      value={(!isInitialMount.current && !selectValue) ? currentDefaultValue : selectValue}
      defaultValue={currentDefaultValue}>
      {showPlaceholder &&
        <option className="placeholder" disabled key="" value={placeholderValue.current}>{props.placeholder}</option>
      }
      {options instanceof Array ?
        options.map((value, index) => <option key={index} value={value}>{value}</option>)
        :
        Object.keys(options).map((key) => <option key={key} value={key}>{options[key]}</option>)
      }
    </select>
  );
}
