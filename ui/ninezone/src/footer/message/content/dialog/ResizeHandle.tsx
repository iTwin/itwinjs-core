/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../../utilities/Props";
import "./ResizeHandle.scss";

export interface MessageResizeHandleProps extends CommonProps {
  title?: React.ReactNode;
  buttons?: React.ReactNode;
}

// tslint:disable-next-line:variable-name
export const MessageResizeHandle: React.StatelessComponent<MessageResizeHandleProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-dialog-resizeHandle",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      <div className="dot" />
    </div>
  );
};

export default MessageResizeHandle;
