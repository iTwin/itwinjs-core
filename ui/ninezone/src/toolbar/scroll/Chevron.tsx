/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import Direction, { DirectionHelpers } from "../../utilities/Direction";
import "./Chevron.scss";

/** Properties of [[Chevron]] component. */
export interface ChevronProps extends CommonProps, NoChildrenProps {
  /** Direction of chevron. */
  direction: Direction;
  /** Function called when chevron is clicked. */
  onClick?: () => void;
}

/** Chevron component used in [[Indicator]]. */
export default class Chevron extends React.Component<ChevronProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-scroll-chevron",
      DirectionHelpers.getCssClassName(this.props.direction),
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
