/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../../utilities/Props";
import "./Title.scss";

export interface DialogTitleProps extends CommonProps {
  children?: string;
}

// tslint:disable-next-line:variable-name
export const DialogTitle: React.StatelessComponent<DialogTitleProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-dialog-title",
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

export default DialogTitle;
