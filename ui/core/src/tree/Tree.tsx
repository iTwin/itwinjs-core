/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as classnames from "classnames";
import * as React from "react";

import "./Tree.scss";

/** Props for the Tree presentational React component */
export interface TreeProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** Presentation React component for a Tree */
export default class Tree extends React.Component<TreeProps> {
  public render() {
    const className = classnames(
      "nz-tree-tree",
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
