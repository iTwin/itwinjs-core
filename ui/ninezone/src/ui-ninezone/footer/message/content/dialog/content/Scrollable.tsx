/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../../../../utilities/Props";
import "./Scrollable.scss";

/** Properties of [[ScrollableContent]] component. */
export interface ScrollableContentProps extends CommonProps, NoChildrenProps {
  /** Actual content. */
  content?: React.ReactNode;
}

/** Scrollable content of [[Dialog]] component. */
export class ScrollableContent extends React.PureComponent<ScrollableContentProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-dialog-content-scrollable",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-content">
          {this.props.content}
        </div>
      </div>
    );
  }
}
