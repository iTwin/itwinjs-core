/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../../../utilities/Props";
import "./TitleBar.scss";

/** Properties of [[TitleBar]] component. */
export interface TitleBarProps extends CommonProps, NoChildrenProps {
  /** Title of title bar. I.e. [[DialogTitle]] */
  title?: React.ReactNode;
  /** Buttons of title bar. I.e. [[DialogButton]] */
  buttons?: React.ReactNode;
}

/** Title bar of [[Dialog]] component. */
// tslint:disable-next-line:variable-name
export const TitleBar: React.StatelessComponent<TitleBarProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-dialog-titleBar",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      {props.title}
      {props.buttons}
    </div>
  );
};

export default TitleBar;
