/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import Popover from "../../popup/popover/Triangle";
import Direction from "../../utilities/Direction";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Toggle.scss";

/** Properties of [[Toggle]] component. */
export interface ToggleProps extends CommonProps, NoChildrenProps {
  /** Content of the toggle. */
  content?: React.ReactNode;
  /** Function called when the toggle is clicked. */
  onClick?: () => void;
  /** Content of the popover. */
  popoverContent?: React.ReactChild;
}

/**
 * Tool settings toggle component.
 * @note Used as content in [[Settings]] and [[Nested]] components
 */
export default class Toggle extends React.Component<ToggleProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-toggle",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div
          className="nz-toggle"
          onClick={this._handleOnClick}
        >
          <div className="nz-content">
            {this.props.content}
          </div>
          <div className="nz-triangle" />
        </div>
        {!this.props.popoverContent ? undefined :
          <Popover
            className="nz-popover"
            direction={Direction.Bottom}
            content={this.props.popoverContent}
          />
        }
      </div>
    );
  }

  private _handleOnClick = () => {
    this.props.onClick && this.props.onClick();
  }
}
