/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import Props from "../../utilities/Props";

import Activity from "./Activity";
import "./Sticky.scss";

// tslint:disable-next-line:variable-name
export const Sticky: React.StatelessComponent<Props> = (props) => {
  const className = classnames(
    "nz-footer-message-sticky",
    props.className);

  return (
    <Activity
      className={className}
      style={props.style}
    >
      {props.children}
    </Activity>
  );
};

export default Sticky;
