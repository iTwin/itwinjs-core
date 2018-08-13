/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../../../utilities/Props";
import "./ResizeHandle.scss";

/** Properties of [[MessageResizeHandle]] component. */
export interface MessageResizeHandleProps extends CommonProps, NoChildrenProps {
}

/** Resize handle of [[Dialog]] component. */
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
      <div className="nz-dot" />
    </div>
  );
};

export default MessageResizeHandle;
