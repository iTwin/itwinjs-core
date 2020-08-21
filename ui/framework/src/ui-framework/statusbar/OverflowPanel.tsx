/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import "./OverflowPanel.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, Popup } from "@bentley/ui-core";

/** Properties of [[StatusBarOverflowPanel]] component.
 * @internal
 */
export interface StatusBarOverflowPanelProps extends CommonProps {
  /** Panel content. */
  children?: React.ReactNode;
  onClose: () => void;
  target: HTMLElement | undefined;
  open: boolean;
}

/** Displays overflow status bar items.
 * @internal
 */
export function StatusBarOverflowPanel(props: StatusBarOverflowPanelProps) {
  const className = classnames(
    "uifw-statusbar-panel",
    props.className,
  );
  return (
    <Popup
      className={className}
      isOpen={props.open}
      offset={0}
      onClose={props.onClose}
      style={props.style}
      showShadow={true}
      target={props.target}
    >
      {props.children}
    </Popup>
  );
}
