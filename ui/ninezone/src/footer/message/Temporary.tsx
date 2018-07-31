/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import Props from "../../utilities/Props";
import "./Temporary.scss";

// tslint:disable-next-line:variable-name
export const Temporary: React.StatelessComponent<Props> = (props) => {
  const className = classnames(
    "nz-footer-message-temporary",
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

export default Temporary;
