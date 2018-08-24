/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
