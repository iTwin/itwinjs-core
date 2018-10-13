/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as React from "react";
import * as classnames from "classnames";
import "./WaitSpinner.scss";

/** Wait Spinner / Loader React component */
export function WaitSpinner(props: any) {
  const className = classnames("bui-waitspinner-div", props.className);
  return (
    <div className={className}>
      <div className="bui-waitspinner-loader"><i /><i /><i /><i /><i /><i /></div>
    </div>
  );
}
