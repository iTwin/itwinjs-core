/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import Props from "../../../../../utilities/Props";
import "./Scrollable.scss";

// tslint:disable-next-line:variable-name
export const ScrollableMessage: React.StatelessComponent<Props> = (props) => {
  const className = classnames(
    "nz-footer-message-content-dialog-content-scrollable",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      <div>
        {props.children}
      </div>
    </div>
  );
};

export default ScrollableMessage;
