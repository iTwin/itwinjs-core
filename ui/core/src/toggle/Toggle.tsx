/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toggle */

import * as React from "react";
import * as classnames from "classnames";
import { CSSProperties } from "react";
import { CommonProps } from "../Props";
import "./Toggle.scss";

/** Toggle Button Type enum */
export enum ToggleButtonType {
  Primary,
  Blue,
}

/** Properties for [[Toggle]] component */
export interface ToggleProps extends CommonProps {
  disabled?: boolean;
  isOn?: boolean;
  rounded?: boolean;
  showCheckmark: boolean;
  buttonType?: ToggleButtonType;
  onChange?: (checked: boolean) => any;
}

interface ToggleState {
  height: number;
  width: number;
  checked: boolean;
}

/**
 * Toggle React component
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
