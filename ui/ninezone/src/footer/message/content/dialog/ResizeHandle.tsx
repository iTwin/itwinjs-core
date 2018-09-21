/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../../../utilities/Props";
import "./ResizeHandle.scss";

/** Properties of [[MessageResizeHandle]] component. */
export interface MessageResizeHandleProps extends CommonProps, NoChildrenProps {
}

/** Resize handle of [[Dialog]] component. */
export class MessageResizeHandle extends React.PureComponent<MessageResizeHandleProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-dialog-resizeHandle",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-dot" />
      </div>
    );
  }
}
