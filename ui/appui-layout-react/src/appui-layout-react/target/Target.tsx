/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./Target.scss";
import classnames from "classnames";
import * as React from "react";

/** @internal */
export interface TargetProps {
  type: "start" | "end" | "fill" | "panel";
  direction: "horizontal" | "vertical";
}

/** @internal */
export function Target(props: TargetProps) { // TODO: split into multiple components
  const className = classnames(
    "nz-target-target",
    `nz-${props.type}`,
    `nz-${props.direction}`,
  );
  return (
    <div
      className={className}
    >
      <div className={classnames(
        "nz-section",
        "nz-start",
        "start" === props.type && "nz-target",
      )} />
      <div className="nz-border" />
      <div className={classnames(
        "nz-section",
        "nz-end",
        "end" === props.type && "nz-target",
      )}/>
    </div>
  );
}
