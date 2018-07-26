/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as classnames from "classnames";
import * as React from "react";

import Direction, { DirectionHelpers } from "../../utilities/Direction";
import CommonProps from "../../utilities/Props";

import "./Popover.scss";

export interface PopoverProps extends CommonProps {
  direction?: Direction;
  isOpen?: boolean;
}

// tslint:disable-next-line:variable-name
export const Popover: React.StatelessComponent<PopoverProps> = (props) => {
  const className = classnames(
    "nz-popup-popover-popover",
    props.isOpen && "nz-is-open",
    DirectionHelpers.getCssClassName(props.direction || Direction.Left),
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      {props.children}
    </div>
  );
};

export default Popover;
