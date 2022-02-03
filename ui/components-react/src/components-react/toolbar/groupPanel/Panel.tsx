/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import "./Panel.scss";
import classnames from "classnames";
import * as React from "react";
import type { CommonProps } from "@itwin/core-react";

/** Properties of [[Panel]] component.
 * @internal
 */
export interface PanelProps extends CommonProps {
  /** Panel content. */
  children?: React.ReactNode;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

/** Basic panel used in Toolbar popups. Used as base in [[Group]] and [[NestedGroup]] components.
 * @internal
 */
export function Panel(props: PanelProps) {
  const className = classnames(
    "components-toolbar-item-expandable-group-panel",
    props.className);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className={className}
      style={props.style}
      onKeyDown={props.onKeyDown}
      role="region"
    >
      {props.children}
    </div>
  );
}
