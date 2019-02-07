/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../utilities/Props";
import "./Tab.scss";

/** Properties of [[ToolSettings]] component. */
export interface ToolSettingsTabProps extends CommonProps {
  /** Tab icon. */
  children?: React.ReactNode;
  /** Describes if the tab is active. */
  isActive?: boolean;
  /** Function called when the tab is clicked. */
  onClick?: () => void;
  /** Function called when a key is pressed. */
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** Title for the item. */
  title?: string;
}

/**
 * Tool settings widget tab.
 * @note Used in [[ToolSettings]] component.
 */
export class ToolSettingsTab extends React.PureComponent<ToolSettingsTabProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-tab",
      this.props.isActive && "nz-is-active",
      this.props.className);

    return (
      <button
        className={className}
        style={this.props.style}
        onClick={this.props.onClick}
        onKeyDown={this.props.onKeyDown}
        title={this.props.title}
      >
        {this.props.children}
      </button>
    );
  }
}
