/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import Activity, { ActivityProps } from "./Activity";
import "./Sticky.scss";

/** Sticky message as defined in 9-Zone UI spec. Used in [[Footer]] component. */
// tslint:disable-next-line:variable-name
export const Sticky: React.StatelessComponent<ActivityProps> = (props) => {
  const { className, ...other } = props;

  return (
    <Activity
      {...other}
      className={classnames(
        "nz-footer-message-sticky",
        className,
      )}
    />
  );
};

export default Sticky;
