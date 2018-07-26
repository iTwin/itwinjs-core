/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as classnames from "classnames";
import * as React from "react";

import Popover, { PopoverProps } from "./Popover";
import "./Triangle.scss";
import { NoChildrenProps } from "../../utilities/Props";

export interface TriangleProps extends PopoverProps, NoChildrenProps {
  content?: React.ReactNode;
  triangleClassName?: string;
}

// tslint:disable-next-line:variable-name
export const Triangle: React.StatelessComponent<TriangleProps> = (props) => {
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
      <div className={
        classnames(
          "nz-triangle",
          props.triangleClassName,
        )}
      />
    </Popover>
  );
};

export default Triangle;
