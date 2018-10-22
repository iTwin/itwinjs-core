/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as classnames from "classnames";
import * as React from "react";

import "./Branch.scss";

/** Properties for [[TreeBranch]] React component */
export interface TreeBranchProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** Presentation React component for a Tree branch */
export default class TreeBranch extends React.Component<TreeBranchProps> {
  public render() {
    const className = classnames(
      "nz-tree-branch",
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
