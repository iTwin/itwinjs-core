/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../utilities/Props";
import withTheme, { WithThemeProps } from "../../../theme/WithTheme";
import "./Button.scss";

export interface MessageButtonProps extends CommonProps {
  onClick?: () => void;
}

const button: React.StatelessComponent<MessageButtonProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-button",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
      onClick={props.onClick}
    >
      {props.children}
    </div>
  );
};

// tslint:disable-next-line:variable-name
export const MessageButton: React.ComponentClass<MessageButtonProps & WithThemeProps> = withTheme(button);

export default MessageButton;
