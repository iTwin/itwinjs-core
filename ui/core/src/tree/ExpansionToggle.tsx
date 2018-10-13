/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as classnames from "classnames";
import * as React from "react";

import "./ExpansionToggle.scss";

/** Properties for the [[ExpansionToggle]] component */
export interface ExpansionToggleProps {
  isExpanded?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** ExpansionToggle React component used by the [[TreeNode]] component */
export default class ExpansionToggle extends React.Component<ExpansionToggleProps> {
  public render() {
    const className = classnames(
      "nz-tree-expansionToggle",
      this.props.isExpanded && "is-expanded",
      this.props.className);

    return (
      <div
        onClick={this.props.onClick}
        className={className}
        style={this.props.style}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="toggle">
          <path d="m4.7 0l-1.4 1.4 6.6 6.6-6.6 6.6 1.4 1.4 8-8z" />
        </svg>
      </div>
    );
  }
}
