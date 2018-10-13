/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { DirectionHelpers } from "../../utilities/Direction";
import Chevron, { ChevronProps } from "./Chevron";
import "./Indicator.scss";

/** Scroll indicator component. Used in [[Scrollable]] */
export default class Indicator extends React.Component<ChevronProps> {
  public render() {
    const { className, style, ...props } = this.props;
    const indicatorClassName = classnames(
      "nz-toolbar-scroll-indicator",
      DirectionHelpers.getCssClassName(this.props.direction),
      className);

    return (
      <div
        className={indicatorClassName}
        style={style}
      >
        <Chevron
          {...props}
        />
      </div>
    );
  }
}
