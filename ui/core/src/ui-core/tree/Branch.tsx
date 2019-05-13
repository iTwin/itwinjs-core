/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as classnames from "classnames";
import * as React from "react";

import "./Branch.scss";
import { CommonProps } from "../utils/Props";

/** Properties for [[TreeBranch]] React component
 * @public
 */
export interface TreeBranchProps extends CommonProps {
  /** Child nodes of the tree branch */
  children?: React.ReactNode;
}

/** Presentation React component for a Tree branch
 * @public
 */
export class TreeBranch extends React.PureComponent<TreeBranchProps> {
  public render() {
    const className = classnames(
      "core-tree-branch",
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
