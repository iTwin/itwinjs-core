/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../../../utilities/Props";
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
