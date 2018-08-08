/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
