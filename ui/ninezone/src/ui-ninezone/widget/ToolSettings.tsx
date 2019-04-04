/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../utilities/Props";
import { TitleBar } from "../footer/message/content/dialog/TitleBar";
import { DialogTitle } from "../footer/message/content/dialog/Title";
import "./ToolSettings.scss";

/** Properties of [[ToolSettings]] component. */
export interface ToolSettingsProps extends CommonProps {
  /** Title bar buttons. I.e.: [[DialogButton]] */
  buttons?: React.ReactNode;
  /** Tool settings content. I.e.: [[ToolSettingsContent]], [[Nested]], [[ScrollableArea]] */
  children?: React.ReactNode;
  /** Widget title. */
  title?: string;
}

/**
 * Tool settings widget is used to display Tool Settings and Tool Assistance (Zone 2 in 9-Zone UI).
 * @note Should be placed in [[Zone]] component.
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
          buttons={this.props.buttons}
          title={
            <DialogTitle text={this.props.title} />
          }
        />
        {this.props.children}
      </div>
    );
  }
}
