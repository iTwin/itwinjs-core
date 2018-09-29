/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../../../utilities/Props";
import "./Title.scss";

/** Properties of [[DialogTitle]] component. */
export interface DialogTitleProps extends CommonProps, NoChildrenProps {
  /** Actual title. */
  text?: string;
}

/** Title used in [[TitleBar]] component. */
// tslint:disable-next-line:variable-name
export const DialogTitle: React.StatelessComponent<DialogTitleProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-dialog-title",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      {props.text}
    </div>
  );
};

export default DialogTitle;
