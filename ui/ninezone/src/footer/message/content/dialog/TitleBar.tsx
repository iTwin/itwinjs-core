/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../../utilities/Props";
import "./TitleBar.scss";

export interface TitleBarProps extends CommonProps {
  title?: React.ReactNode;
  buttons?: React.ReactNode;
}

// tslint:disable-next-line:variable-name
export const TitleBar: React.StatelessComponent<TitleBarProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-dialog-titleBar",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      {props.title}
      {props.buttons}
    </div>
  );
};

export default TitleBar;
