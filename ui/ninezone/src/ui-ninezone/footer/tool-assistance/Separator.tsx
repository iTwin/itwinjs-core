/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Separator.scss";

/** Properties of [[ToolAssistanceSeparator]] component.
 * @beta
 */
export interface ToolAssistanceSeparatorProps extends CommonProps {
  /** Separator label. */
  children?: string;
}

/** Tool assistance item separator used in [[ToolAssistanceDialog]] component.
 * @beta
 */
export class ToolAssistanceSeparator extends React.PureComponent<ToolAssistanceSeparatorProps> {
  public render() {
    const className = classnames(
      "nz-footer-toolAssistance-separator",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-label">
          {this.props.children}
        </div>
        <div className="nz-separator" />
      </div>
    );
  }
}
