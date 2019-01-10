/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../utilities/Props";
import "./Activity.scss";

/** Properties of [[Activity]] component. */
export interface ActivityProps extends CommonProps {
  /** Message content. */
  children?: React.ReactNode;
}

/** Activity message as defined in 9-Zone UI spec. Used in [[Footer]] component. */
export class Activity extends React.PureComponent<ActivityProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-activity",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
