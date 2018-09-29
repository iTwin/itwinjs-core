/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./Arrow.scss";

/**
 * Arrow icon.
 * @note Used in [[Merge]], [[Back]] components.
 */
// tslint:disable-next-line:variable-name
export const Arrow: React.StatelessComponent<CommonProps> = (props: CommonProps) => {
  const className = classnames(
    "nz-zones-target-arrow",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    />
  );
};

export default Arrow;
