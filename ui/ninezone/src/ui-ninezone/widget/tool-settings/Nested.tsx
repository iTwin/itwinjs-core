/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Nested.scss";

/** Properties of [[Nested]] component.
 * @alpha
 */
export interface NestedProps extends CommonProps {
  /** Nested settings label. */
  label?: string;
  /** Back button icon. */
  backButton?: React.ReactNode;
}

/** Nested tool settings component. Used as content in [[ToolSettings]] and [[Toggle]] components.
 * @alpha
 */
export class Nested extends React.PureComponent<NestedProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-nested",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-header">
          <div className="nz-button">
            {this.props.backButton}
          </div>
          <div className="nz-label">
            {this.props.label}
          </div>
        </div>
        {this.props.children}
      </div>
    );
  }
}
