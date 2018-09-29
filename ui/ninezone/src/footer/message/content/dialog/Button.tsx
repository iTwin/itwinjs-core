/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../../utilities/Props";
import "./Button.scss";

/** Properties of [[DialogButton]] component. */
export interface DialogButtonProps extends CommonProps {
  /** Button icon. */
  children?: React.ReactNode;
  /** Function called when button is clicked. */
  onClick?: () => void;
}

/** Button used in [[TitleBar]] component. */
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
