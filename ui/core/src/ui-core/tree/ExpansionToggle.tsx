/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as classnames from "classnames";
import * as React from "react";

import "./ExpansionToggle.scss";
import { CommonProps } from "../utils/Props";

/** Properties for the [[ExpansionToggle]] component
 * @public
 */
export interface ExpansionToggleProps extends CommonProps {
  isExpanded?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  ["data-testid"]?: string;
}

/** ExpansionToggle React component used by the [[TreeNode]] component to show collapsed or expanded state
 * @public
 */
export class ExpansionToggle extends React.PureComponent<ExpansionToggleProps> {
  public render() {
    const className = classnames(
      "core-tree-expansionToggle",
      this.props.isExpanded && "is-expanded",
      this.props.className);

    return (
      <div
        onClick={this.props.onClick}
        className={className}
        style={this.props.style}
        data-testid={this.props["data-testid"]}
      >
        <i className="toggle icon icon-chevron-right" />
      </div>
    );
  }
}
