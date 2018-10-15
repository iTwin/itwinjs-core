/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import Target, { TargetProps } from "./Target";
import Arrow from "./Arrow";
import "./Merge.scss";

/** Merge target. */
// tslint:disable-next-line:variable-name
export const Merge: React.StatelessComponent<TargetProps> = (props: TargetProps) => {
  const mergeClassName = classnames(
    "nz-zones-target-merge",
    props.className);

  return (
    <Target
      className={mergeClassName}
      {...props}
    >
      <Arrow className="nz-arrow" />
      <Arrow className="nz-mirrored" />
    </Target>
  );
};

export default Merge;
