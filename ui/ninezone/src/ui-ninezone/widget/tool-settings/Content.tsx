/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Content.scss";

/** Used to display tool settings content in [[ToolSettings]], [[Toggle]] and [[ScrollableArea]] components.
 * @alpha
 */
export class ToolSettingsContent extends React.PureComponent<CommonProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-content",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
