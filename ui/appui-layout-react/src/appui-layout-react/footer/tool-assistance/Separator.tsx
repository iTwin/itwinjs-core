/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolAssistance
 */

import "./Separator.scss";
import classnames from "classnames";
import * as React from "react";
import type { CommonProps } from "@itwin/core-react";

/** Properties of [[ToolAssistanceSeparator]] component.
 * @internal
 */
export interface ToolAssistanceSeparatorProps extends CommonProps {
  /** Separator label. */
  children?: string;
}

/** Tool assistance item separator used in [[ToolAssistanceDialog]] component.
 * @internal
 */
export class ToolAssistanceSeparator extends React.PureComponent<ToolAssistanceSeparatorProps> {
  public override render() {
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
