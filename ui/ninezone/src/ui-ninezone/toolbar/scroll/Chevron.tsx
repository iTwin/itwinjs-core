/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "@bentley/ui-core";
import { Direction, DirectionHelpers } from "../../utilities/Direction";
import "./Chevron.scss";

/** Properties of [[Chevron]] component.
 * @alpha
 */
export interface ChevronProps extends CommonProps, NoChildrenProps {
  /** Direction of chevron. */
  direction: Direction;
  /** Function called when chevron is clicked. */
  onClick?: () => void;
}

/** Chevron used in [[Indicator]] component.
 * @alpha
 */
export class Chevron extends React.PureComponent<ChevronProps> {
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
