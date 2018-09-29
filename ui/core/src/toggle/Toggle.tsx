/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toggle */

import * as React from "react";
import * as classnames from "classnames";
import { CSSProperties } from "react";
import { CommonProps } from "../Props";
import "./Toggle.scss";

/** Toggle display types */
export enum ToggleButtonType {
  /** Primary (green) background */
  Primary,
  /** Blue background */
  Blue,
}

/** Properties for [[Toggle]] component */
export interface ToggleProps extends CommonProps {
  /** Determine if the toggle is disabled or not */
  disabled?: boolean;
  /** Determine if the toggle is "on" or "off" */
  isOn?: boolean;
  /** Show the toggle rounded or square (rounded is default) */
  rounded?: boolean;
  /** Show a check mark icon when the toggle is "on" */
  showCheckmark: boolean;
  /** Button type, either Primary or Blue */
  buttonType?: ToggleButtonType;
  /** Function called when the toggle state is changed */
  onChange?: (checked: boolean) => any;
}

interface ToggleState {
  height: number;
  width: number;
  checked: boolean;
}

/**
 * Toggle React component
 * Component to show an "on" or "off state
 */
export class Toggle extends React.Component<ToggleProps, ToggleState> {
  private _padding: number = 2;

  constructor(props: ToggleProps, context?: any) {
    super(props, context);

    this.state = { height: 0, width: 0, checked: this.props.isOn! };
  }

  public static defaultProps: Partial<ToggleProps> = {
    rounded: true,
    isOn: false,
    showCheckmark: true,
    buttonType: ToggleButtonType.Blue,
  };

  private _handleChange = () => {
    this.setState({ checked: !this.state.checked }, () => { this.props.onChange && this.props.onChange(this.state.checked); });
  }

  private _setHeight = (newHeight: number, newWidth: number) => {
    if (this.state.height !== newHeight || this.state.width !== newWidth) {
      this.setState({ height: newHeight, width: newWidth });
    }
  }

  private _getOffset(): number {
    return (this.state.checked) ? this.state.width - this.state.height : 0;
  }

  public render(): JSX.Element {
    const halfHeight = this.state.height / 2;
    const checkmarkClassName = classnames("toggle-checkmark icon icon-checkmark", this.props.showCheckmark && "visible");
    const toggleStyle: CSSProperties = { borderRadius: this.props.rounded ? halfHeight : 3, fontSize: halfHeight };
    const toggleClassName = classnames(
      "toggle",
      this.props.buttonType === ToggleButtonType.Primary && "toggle-primary",
      this.props.rounded && "rounded",
      { disabled: this.props.disabled },
      this.props.className);
    const toggleHandleStyle: CSSProperties = {
      width: this.state.height - (this._padding * 2),
      transform: "translateX(" + this._getOffset() + "px)",
      top: this._padding,
      bottom: this._padding,
      left: this._padding,
    };
    return (
      <label ref={(el) => { if (el) this._setHeight(el.clientHeight, el.clientWidth); }} style={toggleStyle} className={toggleClassName}>
        <input defaultChecked={this.props.isOn} className="toggle-input" disabled={this.props.disabled} type="checkbox" onChange={this._handleChange} />
        <span className="toggle-label" />
        <span className={checkmarkClassName} />
        <span className="toggle-handle" style={toggleHandleStyle} />
      </label>
    );
  }
}

export default Toggle;
