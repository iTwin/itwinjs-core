/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../utilities/Props";
import Direction, { DirectionHelpers } from "../../utilities/Direction";
import "./Arrow.scss";

export interface ArrowProps extends CommonProps {
  direction?: Direction;
  onClick?: () => void;
}

export default class Arrow extends React.Component<ArrowProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-scroll-arrow",
      DirectionHelpers.getCssClassName(this.props.direction || Direction.Left),
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        onClick={this.props.onClick}
      />
    );
  }
}
