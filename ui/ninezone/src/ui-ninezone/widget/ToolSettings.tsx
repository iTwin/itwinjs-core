/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { TitleBar } from "../footer/dialog/TitleBar";
import "./ToolSettings.scss";

/** Properties of [[ToolSettings]] component.
 * @beta
 */
export interface ToolSettingsProps extends CommonProps {
  /** Title bar buttons. I.e. [[TitleBarButton]] */
  buttons?: React.ReactNode;
  /** Tool settings content or content container. I.e. [[NestedToolSettings]], [[ScrollableToolSettings]] */
  children?: React.ReactNode;
  /** Tool settings title bar title. */
  title?: string;
}

/** Tool settings widget is used to display Tool Settings and Tool Assistance (in Zone 2 of 9-Zone UI).
 * @note Should be placed in [[Zone]] component.
 * @beta
 */
export class ToolSettings extends React.PureComponent<ToolSettingsProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <TitleBar
          title={this.props.title}
          className="nz-title"
        >
          {this.props.buttons}
        </TitleBar>
        <div className="nz-content">
          {this.props.children}
        </div>
      </div>
    );
  }
}
