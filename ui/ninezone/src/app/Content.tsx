/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module App */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../utilities/Props";
import "./Content.scss";

/** Properties of [[Content]] component. */
export interface ContentProps extends CommonProps, React.HTMLAttributes<HTMLDivElement> {
  /** Actual app content here (i.e. viewport). */
  children?: React.ReactNode;
}

/** Content component of 9-Zone UI app. */
export default class Content extends React.Component<ContentProps> {
  public render() {
    const { className, ...props } = this.props;

    const contentClassName = classnames(
      "nz-app-content",
      this.props.className);

    return (
      <div
        className={contentClassName}
        style={this.props.style}
        {...props}
      >
        {this.props.children}
      </div>
    );
  }
}
