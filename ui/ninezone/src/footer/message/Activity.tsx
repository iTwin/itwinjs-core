/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./Activity.scss";

/** Properties of [[Activity]] component. */
export interface ActivityProps extends CommonProps {
  /** Message content. */
  children?: React.ReactNode;
}

/** Activity message as defined in 9-Zone UI spec. Used in [[Footer]] component. */
// tslint:disable-next-line:variable-name
export const Activity: React.StatelessComponent<ActivityProps> = (props) => {
  const className = classnames(
    "nz-footer-message-activity",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      {props.children}
    </div>
  );
};

export default Activity;
