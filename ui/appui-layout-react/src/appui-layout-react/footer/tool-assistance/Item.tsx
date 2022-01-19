/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolAssistance
 */

import "./Item.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@itwin/core-react";

/** Properties of [[ToolAssistanceItem]] component.
 * @internal
 */
export interface ToolAssistanceItemProps extends CommonProps {
  /** Assistance instructions or components */
  children?: React.ReactNode;
}

/** Tool assistance item used in [[ToolAssistanceDialog]] component.
 * @internal
 */
export class ToolAssistanceItem extends React.PureComponent<ToolAssistanceItemProps> {
  public override render() {
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
