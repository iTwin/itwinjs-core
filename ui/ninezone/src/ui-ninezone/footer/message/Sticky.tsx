/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { Activity, ActivityProps } from "./Activity";
import "./Sticky.scss";

/** Sticky message as defined in 9-Zone UI spec. Used in [[Footer]] component. */
export class Sticky extends React.PureComponent<ActivityProps> {
  public render() {
    const { className, ...other } = this.props;

    return (
      <Activity
        {...other}
        className={classnames(
          "nz-footer-message-sticky",
          className,
        )}
      />
    );
  }
}
