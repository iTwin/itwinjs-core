/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import Icon from "./Icon";
import { ToolbarButtonProps } from "./Button";
import "./Back.scss";

export default class BackButton extends React.Component<ToolbarButtonProps> {
  public render() {
    const { className, ...props } = this.props;
    const buttonClassName = classnames(
      "nz-toolbar-button-back",
      className);

    return (
      <Icon
        className={buttonClassName}
        icon={this.props.children}
        {...props}
      />
    );
  }
}
