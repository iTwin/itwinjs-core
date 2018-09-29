/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as classnames from "classnames";
import * as React from "react";
import { OmitChildrenProp, NoChildrenProps } from "../../utilities/Props";
import Popover, { PopoverProps } from "./Popover";
import "./Triangle.scss";

/** Properties of [[Triangle]] component. */
export interface TrianglePopoverProps extends OmitChildrenProp<PopoverProps>, NoChildrenProps {
  content?: React.ReactNode;
}

/** Popover with triangle connection. */
// tslint:disable-next-line:variable-name
export const TrianglePopover: React.StatelessComponent<TrianglePopoverProps> = (props) => {
  const className = classnames(
    "nz-popup-popover-triangle",
    props.className);

  return (
    <Popover
      {...props}
      className={className}
    >
      <div className="nz-content">
        {props.content}
      </div>
      <div className="nz-triangle" />
    </Popover>
  );
};

export default TrianglePopover;
