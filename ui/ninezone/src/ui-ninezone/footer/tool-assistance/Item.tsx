/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Item.scss";

/** Properties of [[ToolAssistanceItem]] component.
 * @beta
 */
export interface ToolAssistanceItemProps extends CommonProps {
  /** Assistance items and separators. I.e.: [[ToolAssistanceItem]], [[ToolAssistanceSeparator]] */
  children?: React.ReactNode;
}

/** Tool assistance item used in [[ToolAssistanceDialog]] component.
 * @beta
 */
export class ToolAssistanceItem extends React.PureComponent<ToolAssistanceItemProps> {
  public render() {
    const className = classnames(
      "nz-footer-toolAssistance-item",
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
