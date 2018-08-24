/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import Target, { TargetProps } from "./Target";
import Arrow from "./Arrow";
import "./Back.scss";

/** Back home target. */
// tslint:disable-next-line:variable-name
export const Back: React.StatelessComponent<TargetProps> = (props: TargetProps) => {
  const mergeClassName = classnames(
    "nz-zones-target-back",
    props.className);

  return (
    <Target
      className={mergeClassName}
      {...props}
    >
      <Arrow className="nz-arrow" />
    </Target>
  );
};

export default Back;
