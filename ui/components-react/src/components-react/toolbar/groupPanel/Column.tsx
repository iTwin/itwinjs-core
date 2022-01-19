/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import "./Column.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@itwin/core-react";

/** Properties of [[GroupColumn]] component.
 * @internal
 */
export interface GroupColumnProps extends CommonProps {
  /** Actual content. I.e. tool items: [[GroupToolExpander]], [[GroupTool]] */
  children?: React.ReactNode;
}

/** Tool group column. Used in [[Group]] components.
 * @internal
 */
export function GroupColumn(props: GroupColumnProps) {
  const className = classnames(
    "components-toolbar-item-expandable-group-column",
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
