/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { TitleBar } from "./tool-settings/TitleBar";
import "./ToolSettings.scss";

/** Properties of [[ToolSettings]] component.
 * @alpha
 */
export interface ToolSettingsProps extends CommonProps {
  /** Title bar buttons. I.e.: [[DialogButton]] */
  buttons?: React.ReactNode;
  /** Tool settings content. I.e.: [[ToolSettingsContent]], [[Nested]], [[ScrollableArea]] */
  children?: React.ReactNode;
  /** Widget title. */
  title?: string;
}

/** Tool settings widget is used to display Tool Settings and Tool Assistance (Zone 2 in 9-Zone UI).
 * @note Should be placed in [[Zone]] component.
 * @alpha
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
        >
          {this.props.buttons}
        </TitleBar>
        {this.props.children}
      </div>
    );
  }
}
