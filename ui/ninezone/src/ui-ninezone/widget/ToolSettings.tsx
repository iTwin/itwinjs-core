/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../utilities/Props";
import "./ToolSettings.scss";

/** Properties of [[ToolSettings]] component. */
export interface ToolSettingsWidgetProps extends CommonProps, NoChildrenProps {
  /** Content of this ToolSettings widget. See: [[Nested]], [[ToolSettings]] */
  content?: React.ReactNode;
  /** Tab to control the content. See [[ToolSettingsTab]] */
  tab?: React.ReactNode;
}

/**
 * Tool settings widget is used to display Tool Settings and Tool Assistance (Zone 2 in 9-Zone UI).
 * @note Should be placed in [[Zone]] component.
 */
export class ToolSettingsWidget extends React.PureComponent<ToolSettingsWidgetProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-content">
          {this.props.content}
        </div>
        <div className="nz-tab">
          {this.props.tab}
        </div>
      </div>
    );
  }
}
