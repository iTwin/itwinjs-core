/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import "./SwitchControl.scss";

export interface ISwitchProps {
  id: string;
  onChange?: (checked: boolean) => any;
  defaultValue?: boolean;
}

export interface ISwitchState {
  checked: boolean;
}

export class SwitchControl extends React.Component<ISwitchProps, ISwitchState> {

  constructor(props: ISwitchProps, context?: any) {
    super(props, context);

    this.state = { checked: (props.defaultValue) ? props.defaultValue : false };
  }

  // checkbox state changed
  private _handleChange = () => {
    this.setState({ checked: !this.state.checked }, () => { this.props.onChange && this.props.onChange(this.state.checked); });
  }

  public render() {
    return (
      <React.Fragment>
        <input className="sw" id={this.props.id} type="checkbox" onChange={this._handleChange} checked={this.state.checked} />
        <label htmlFor={this.props.id}></label>
      </React.Fragment>
    );
  }
}
