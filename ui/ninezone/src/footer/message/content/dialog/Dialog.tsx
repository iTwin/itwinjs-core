/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps, { NoChildrenProps } from "../../../../utilities/Props";
import "./Dialog.scss";

export interface DialogProps extends CommonProps, NoChildrenProps {
  titleBar?: React.ReactNode;
  content?: React.ReactNode;
  resizeHandle?: React.ReactNode;
}

// tslint:disable-next-line:variable-name
export const Dialog: React.StatelessComponent<DialogProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-dialog-dialog",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      <div>
        {props.titleBar}
      </div>
      <div>
        {props.content}
      </div>
      <div className="nz-resize-handle">
        {props.resizeHandle}
      </div>
    </div>
  );
};

export default Dialog;
