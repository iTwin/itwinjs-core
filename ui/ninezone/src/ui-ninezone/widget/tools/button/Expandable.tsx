/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Expandable.scss";

/** Properties of [[ExpandableButton]] component.
 * @alpha
 */
export interface ExpandableButtonProps extends CommonProps {
  /** One of toolbar buttons. I.e. [[Item]] */
  children?: React.ReactNode;
}

/** Expandable toolbar button. Used in [[Toolbar]] component.
 * @alpha
 */
export class ExpandableButton extends React.PureComponent<ExpandableButtonProps> {
  public render() {
    const className = classnames(
      "nz-widget-tools-button-expandable",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
        <div className="nz-triangle" />
      </div>
    );
  }
}
