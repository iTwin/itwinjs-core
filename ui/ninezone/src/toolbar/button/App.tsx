/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import Icon from "./Icon";
import { ToolbarButtonProps } from "./Button";
import "./App.scss";

export default class AppButton extends React.Component<ToolbarButtonProps> {
  public render() {
    const { className, ...props } = this.props;
    const buttonClassName = classnames(
      "nz-toolbar-button-app",
      className);

    return (
      <Icon
        className={buttonClassName}
        icon={this.props.children}
        {...props}
      >
        <div className="nz-bars">
          <div className="nz-bar" />
          <div className="nz-bar" />
          <div className="nz-bar" />
        </div>
      </Icon>
    );
  }
}
