/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../../utilities/Props";
import "./Button.scss";

export interface DialogButtonProps extends CommonProps {
  onClick?: () => void;
}

// tslint:disable-next-line:variable-name
export const DialogButton: React.StatelessComponent<DialogButtonProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-dialog-button",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
      onClick={props.onClick}
    >
      {props.children}
    </div>
  );
};

export default DialogButton;
