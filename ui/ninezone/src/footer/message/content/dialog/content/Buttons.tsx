/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../../../utilities/Props";
import "./Buttons.scss";

export interface ButtonsProps extends CommonProps {
  children?: React.ReactNode;
  content?: React.ReactNode;
}

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
      <div>
        {props.content}
      </div>
      <div className="nz-buttons">
        {props.children}
      </div>
    </div>
  );
};

export default Buttons;
