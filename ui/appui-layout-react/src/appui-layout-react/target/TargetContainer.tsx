/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./TargetContainer.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@itwin/core-react";

/** @internal */
export interface TargetContainerProps extends CommonProps {
  children?: React.ReactNode;
  direction: "horizontal" | "vertical";
}

/** @internal */
export function TargetContainer(props: TargetContainerProps) {
  const className = classnames(
    "nz-target-targetContainer",
    `nz-${props.direction}`,
    props.className,
  );
  return (
    <div
      className={className}
      style={props.style}
    >
      {props.children}
    </div>
  );
}
