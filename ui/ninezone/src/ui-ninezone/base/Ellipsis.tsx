/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Ellipsis.scss";

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
