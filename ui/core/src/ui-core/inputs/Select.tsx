/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

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
}

/** Basic select component
 * @public
 */
export class Select extends React.PureComponent<SelectProps> {
  public render(): JSX.Element {
    const showPlaceholder = !!this.props.placeholder && !this.props.value && !this.props.defaultValue;
    const defaultValue =
      this.props.defaultValue ||                    // first try this.props.defaultValue
      this.props.value && this.props.value + "" ||  // else use current value
      showPlaceholder && "" ||                      // otherwise, if placeholder should show, show nothing
      "";
    const required = showPlaceholder || this.props.required;
    const options = this.props.options;
    return (
      <select {...this.props}
        defaultValue={defaultValue}
        required={required}
        className={classnames("uicore-inputs-select", this.props.className)}
        style={this.props.style}>
        {showPlaceholder &&
          <option className="placeholder" disabled key="" value="">{this.props.placeholder}</option>
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
