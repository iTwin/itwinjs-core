/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { usePointerCaptor } from "../base/PointerCaptor";
import { useRefs } from "../base/useRefs";
import { useToolSettingsEntry } from "./Docked";
import { useResizeObserver } from "../base/useResizeObserver";
import "./Handle.scss";

/** Properties of [[DockedToolSettingsHandle]] component.
 * @internal
 */
export interface DockedToolSettingsHandleProps extends CommonProps {
  onDrag?: () => void;
}

/** Component that displays tool settings as a bar across the top of the content view.
 * @internal
 */
export function DockedToolSettingsHandle(props: DockedToolSettingsHandleProps) {
  const { onResize } = useToolSettingsEntry();
  const resizeObserverRef = useResizeObserver<HTMLDivElement>(onResize);
  const pointerCaptorRef = usePointerCaptor<HTMLDivElement>();
  const ref = useRefs(pointerCaptorRef, resizeObserverRef);
  const className = classnames(
    "nz-toolSettings-handle",
    props.className,
  );
  return (
    <div
      className={className}
      ref={ref}
      style={props.style}
    >
      <div className="nz-row">
        <div className="nz-dot" />
        <div className="nz-dot" />
      </div>
      <div className="nz-row">
        <div className="nz-dot" />
        <div className="nz-dot" />
      </div>
      <div className="nz-row">
        <div className="nz-dot" />
        <div className="nz-dot" />
      </div>
    </div>
  );
}
