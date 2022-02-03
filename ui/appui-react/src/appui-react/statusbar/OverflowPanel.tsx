/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import "./OverflowPanel.scss";
import classnames from "classnames";
import * as React from "react";
import type { CommonProps} from "@itwin/core-react";
import { Popup } from "@itwin/core-react";

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
