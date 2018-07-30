/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../../utilities/Props";
import "./Layout.scss";

export interface MessageLayoutProps extends CommonProps {
  label?: React.ReactNode;
  buttons?: React.ReactNode;
  progress?: React.ReactNode;
}

// tslint:disable-next-line:variable-name
export const MessageLayout: React.StatelessComponent<MessageLayoutProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-status-layout",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      <div className="nz-label">
        {props.label}
      </div>
      <div className="nz-buttons">
        {props.buttons}
      </div>
      <div className="nz-progress">
        {props.progress}
      </div>
    </div>
  );
};

export default MessageLayout;
