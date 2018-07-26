/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import Popover from "../../../../popup/popover/Triangle";
import Direction from "../../../../utilities/Direction";
import CommonProps from "../../../../utilities/Props";
import "./Toggle.scss";

export interface ToggleProps extends CommonProps {
  isOpen?: boolean;
  onIsOpenChange?: (isOpen: boolean) => void;
  popoverContent?: React.ReactChild;
}

export default class Toggle extends React.Component<ToggleProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-settings-popover-toggle",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div
          className="nz-toggle"
          onClick={this.handleOnClick}
        >
          <div className="nz-content">
            {this.props.children}
          </div>
          <div className="nz-triangle" />
        </div>
        <Popover
          className="nz-popover"
          isOpen={this.props.isOpen}
          direction={Direction.Bottom}
          content={this.props.popoverContent}
        />
      </div>
    );
  }

  private handleOnClick = () => {
    this.props.onIsOpenChange && this.props.onIsOpenChange(!this.props.isOpen);
  }
}
