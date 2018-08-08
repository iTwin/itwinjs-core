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

/** Properties of [[StatusMessage]] component. */
export interface StatusMessageProps extends CommonProps {
  /** Content of status message. I.e. [[MessageLayout]] */
  children?: React.ReactNode;
  /** Status icon. */
  icon?: React.ReactNode;
  /** Message status. */
  status: Status;
}

// tslint:disable-next-line:variable-name
const StatusMessageComponent: React.StatelessComponent<StatusMessageProps> = (props) => {
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

/** Status message can be used in one of footer messages. I.e.: [[Toast]], [[Temporary]], [[Sticky]], [[Activity]] */
// tslint:disable-next-line:variable-name
export const StatusMessage: React.ComponentClass<StatusMessageProps & WithThemeProps> = withTheme(StatusMessageComponent);

export default StatusMessage;
