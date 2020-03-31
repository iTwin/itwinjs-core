/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps, useRefs, useResizeObserver } from "@bentley/ui-core";
import { usePointerCaptor } from "../base/PointerCaptor";
import "./Handle.scss";

/** Properties of [[DockedToolSettingsHandle]] component.
 * @internal
 */
export interface DockedToolSettingsHandleProps extends CommonProps {
  onResize?: (w: number) => void;
}

/** Component that displays tool settings as a bar across the top of the content view.
 * @internal
 */
export const DockedToolSettingsHandle = React.memo(function DockedToolSettingsHandle(props: DockedToolSettingsHandleProps) { // tslint:disable-line: variable-name no-shadowed-variable
  const resizeObserverRef = useResizeObserver<HTMLDivElement>(props.onResize);
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
});
