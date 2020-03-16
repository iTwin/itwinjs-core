/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import * as React from "react";
import * as classnames from "classnames";
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

/** Basic select component is a wrapper for the `<select>` HTML element.
 * @public
 */
export class Select extends React.PureComponent<SelectProps> {
  private _selectElement = React.createRef<HTMLSelectElement>();

  public componentDidMount() {
    if (this.props.setFocus && this._selectElement.current) {
      this._selectElement.current.focus();
    }
  }

  public render(): JSX.Element {
    const { required, options, setFocus, className, defaultValue, ...otherProps } = this.props as any; // pluck off values that will be explicitly set below
    const showPlaceholder = !!this.props.placeholder && !this.props.value && !this.props.defaultValue;
    const isRequired = showPlaceholder || required;
    const placeholderValue = "placeholder";
    return (
      <select ref={this._selectElement} {...otherProps}
        required={isRequired}
        className={classnames("uicore-inputs-select", className)}
        defaultValue={showPlaceholder ? placeholderValue : defaultValue}>
        {showPlaceholder &&
          <option className="placeholder" disabled key="" value={placeholderValue}>{this.props.placeholder}</option>
        }
        {options instanceof Array ?
          options.map((value, index) => <option key={index} value={value}>{value}</option>)
          :
          Object.keys(options).map((key) => <option key={key} value={key}>{options[key]}</option>)
        }
      </select>
    );
  }
}
