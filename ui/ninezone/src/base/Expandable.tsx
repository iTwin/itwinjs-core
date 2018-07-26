/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as React from "react";
import * as classnames from "classnames";
import { Direction, DirectionHelpers } from "../utilities/Direction";
import CommonProps from "../utilities/Props";
import "./Expandable.scss";

/** Properties of [[Expandable]] component. */
export interface ExpandableProps extends CommonProps {
  /** Expanded content. */
  expanded?: React.ReactNode;
  /** Direction to which the content will be expanded. Defaults to: [[Direction.Right]] */
  direction?: Direction;
}

/** Expandable component is used to expand content to specified direction. */
export default class Expandable extends React.Component<ExpandableProps> {
  public render() {
    const direction = this.props.direction === undefined ? Direction.Right : this.props.direction;
    const className = classnames(
      "nz-base-expandable",
      DirectionHelpers.getCssClassName(direction),
      this.props.className,
    );
    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
        <div className="nz-expanded">
          {this.props.expanded}
        </div>
      </div>
    );
  }
}
