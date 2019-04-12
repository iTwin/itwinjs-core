/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Title.scss";

/** Properties of [[Title]] component.
 * @alpha
 */
export interface TitleProps extends CommonProps {
  /** Actual title. */
  children?: React.ReactNode;
}

/** Tool group title.
 * @alpha
 */
export class Title extends React.PureComponent<TitleProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-group-title",
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
