/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as classnames from "classnames";
import * as React from "react";
import { OmitChildrenProp, NoChildrenProps } from "../../utilities/Props";
import { Popover, PopoverProps } from "./Popover";
import "./Triangle.scss";

/** Properties of [[TrianglePopover]] component.
 * @alpha
 */
export interface TrianglePopoverProps extends OmitChildrenProp<PopoverProps>, NoChildrenProps {
  content?: React.ReactNode;
}

/** Popover with triangle connection.
 * @alpha Replace by ui-core/popup
 */
export class TrianglePopover extends React.PureComponent<TrianglePopoverProps> {
  public render() {
    const className = classnames(
      "nz-popup-popover-triangle",
      this.props.className);

    return (
      <Popover
        {...this.props}
        className={className}
      >
        <div className="nz-content">
          {this.props.content}
        </div>
        <div className="nz-triangle" />
      </Popover>
    );
  }
}
