/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../utilities/Props";
import Direction, { DirectionHelpers } from "../../utilities/Direction";
import "./Indicator.scss";
import Arrow from "./Arrow";

export interface IndicatorProps extends CommonProps {
  direction?: Direction;
  onScroll?: () => void;
}

export default class Indicator extends React.Component<IndicatorProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-scroll-indicator",
      DirectionHelpers.getCssClassName(this.props.direction || Direction.Left),
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <Arrow
          className={"nz-indicator"}
          onClick={this.props.onScroll}
          direction={this.props.direction}
        />
      </div>
    );
  }
}
