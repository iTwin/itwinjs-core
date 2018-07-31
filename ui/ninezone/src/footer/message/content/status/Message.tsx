/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../../utilities/Props";
import withTheme, { WithThemeProps } from "../../../../theme/WithTheme";
import Status, { StatusHelpers } from "./Status";
import "./Message.scss";

export interface StatusMessageProps extends CommonProps {
  icon?: React.ReactNode;
  status: Status;
}

const statusMessage: React.StatelessComponent<StatusMessageProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-status-message",
    StatusHelpers.getCssClassName(props.status),
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      <div className="nz-icon">
        {props.icon}
      </div>
      {props.children}
    </div>
  );
};

// tslint:disable-next-line:variable-name
export const StatusMessage: React.ComponentClass<StatusMessageProps & WithThemeProps> = withTheme(statusMessage);

export default StatusMessage;
