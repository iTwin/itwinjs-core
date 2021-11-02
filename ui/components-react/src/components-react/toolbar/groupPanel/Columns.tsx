/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import "./Columns.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@itwin/core-react";

/** Properties of [[Columns]] component.
 * @internal
 */
export interface ColumnsProps extends CommonProps {
  /** Actual columns. I.e. [[GroupColumn]] */
  children?: React.ReactNode;
}

/** Columns of tool group. Used in [[Group]], [[NestedGroup]] components.
 * @internal
 */
export function Columns(props: ColumnsProps) {
  const className = classnames(
    "components-toolbar-item-expandable-group-columns",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      {props.children}
    </div>
  );
}
