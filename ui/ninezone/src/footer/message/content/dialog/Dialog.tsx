/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../../../utilities/Props";
import "./Dialog.scss";

/** Properties of [[Dialog]] component. */
export interface DialogProps extends CommonProps, NoChildrenProps {
  /** Title bar of dialog. See [[TitleBar]] */
  titleBar?: React.ReactNode;
  /** Content of dialog. I.e.: [[Buttons]], [[DialogContent]], [[ScrollableContent]]  */
  content?: React.ReactNode;
  /** Resize handle of dialog. See [[MessageResizeHandle]] */
  resizeHandle?: React.ReactNode;
}

/** Dialog used in [[Modal]] component. */
export class Dialog extends React.PureComponent<DialogProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-dialog-dialog",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div>
          {this.props.titleBar}
        </div>
        <div>
          {this.props.content}
        </div>
        <div className="nz-resize-handle">
          {this.props.resizeHandle}
        </div>
      </div>
    );
  }
}
