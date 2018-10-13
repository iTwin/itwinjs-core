/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../../../../utilities/Props";
import "./Buttons.scss";

/** Properties of [[Buttons]] component. */
export interface ButtonsProps extends CommonProps, NoChildrenProps {
  /** Actual buttons. */
  buttons?: React.ReactNode;
  /** Actual content. I.e.: [[DialogContent]], [[ScrollableContent]] */
  content?: React.ReactNode;
}

/** Content with buttons. Used in [[Dialog]] component. */
// tslint:disable-next-line:variable-name
export const Buttons: React.StatelessComponent<ButtonsProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-dialog-content-buttons",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      <div className="nz-content">
        {props.content}
      </div>
      <div className="nz-buttons">
        {props.buttons}
      </div>
    </div>
  );
};

export default Buttons;
