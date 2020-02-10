/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WidgetPanels */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Pane.scss";

/** @internal */
export interface PaneProps extends CommonProps {
  children?: React.ReactNode;
  minimized?: boolean;
  size: number;
}

/** @internal */
export function Pane(props: PaneProps) {
  const style: React.CSSProperties = {
    ...props.minimized ? undefined : { flexGrow: props.size },
    ...props.style,
  };
  const className = classnames(
    "nz-widgetPanels-pane",
    props.minimized && "nz-minimized",
    props.className,
  );
  return (
    <div
      className={className}
      style={style}
    >
      {props.children}
    </div>
  );
}
