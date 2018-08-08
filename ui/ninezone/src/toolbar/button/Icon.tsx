/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import Button, { ToolbarButtonProps } from "./Button";
import "./Icon.scss";

/** Properties of [[ToolbarIcon]] component. */
export interface ToolbarIconProps extends ToolbarButtonProps {
  /** Button icon. */
  icon?: React.ReactNode;
}

/**
 * Toolbar button which displays icon. Used in [[Toolbar]] component.
 * @note See basic button: [[ToolbarButton]]
 */
export default class ToolbarIcon extends React.Component<ToolbarIconProps> {
  public render() {
    const { className, ...props } = this.props;
    const buttonClassName = classnames(
      "nz-toolbar-button-icon",
      className);

    return (
      <Button
        className={buttonClassName}
        {...props}
      >
        <div className="nz-icon">
          {this.props.icon}
        </div>
        {this.props.children}
      </Button>
    );
  }
}
