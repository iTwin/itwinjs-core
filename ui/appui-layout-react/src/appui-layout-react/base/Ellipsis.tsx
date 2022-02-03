/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import "./Ellipsis.scss";
import classnames from "classnames";
import * as React from "react";
import type { CommonProps } from "@itwin/core-react";

/** A component that renders three dots (common for text truncation). Used in overflow buttons.
 * @internal
 */
export function Ellipsis(props: CommonProps) {
  const className = classnames(
    "nz-base-ellipsis",
    props.className,
  );
  return (
    <div
      className={className}
      style={props.style}
    >
      <div className="nz-dot" />
      <div className="nz-dot" />
      <div className="nz-dot" />
    </div>
  );
}
