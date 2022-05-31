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
import { CommonProps } from "@itwin/core-react";

/** @internal */
export interface TargetProps extends CommonProps {
  section: "start" | "end" | "fill";
  direction: "horizontal" | "vertical";
  targeted?: boolean;
}

/** @internal */
export const Target = React.forwardRef<HTMLDivElement, TargetProps>(function Target(props, ref) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const className = classnames(
    "nz-target-target",
    `nz-${props.section}`,
    `nz-${props.direction}`,
    props.targeted && "nz-targeted",
    props.className,
  );
  return (
    <div
      className={className}
      style={props.style}
      ref={ref}
    >
      {props.section !== "fill" && <>
        <div className={classnames(
          "nz-section",
          "nz-start",
          "start" === props.section && "nz-target",
        )} />
        <div className="nz-border" />
        <div className={classnames(
          "nz-section",
          "nz-end",
          "end" === props.section && "nz-target",
        )}/>
      </>}
    </div>
  );
});
