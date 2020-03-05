/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Panel.scss";

/** Properties of [[Panel]] component.
 * @internal
 */
export interface PanelProps extends CommonProps {
  /** Panel content. */
  children?: React.ReactNode;
}

/** Basic panel used in Toolbar popups. Used as base in [[Group]] and [[NestedGroup]] components.
 * @internal
 */
export function Panel(props: PanelProps) {
  const className = classnames(
    "components-toolbar-item-expandable-group-panel",
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
