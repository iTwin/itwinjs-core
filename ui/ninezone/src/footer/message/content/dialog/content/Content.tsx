/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../../../../utilities/Props";
import "./Content.scss";

/** Properties of [[DialogContent]] component. */
export interface DialogContentProps extends CommonProps, NoChildrenProps {
  /** Actual content. */
  content?: React.ReactNode;
}

/** Content of [[Dialog]] component. */
// tslint:disable-next-line:variable-name
export const DialogContent: React.StatelessComponent<DialogContentProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-dialog-content-content",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      <div className="nz-content">
        {props.content}
      </div>
    </div>
  );
};

export default DialogContent;
