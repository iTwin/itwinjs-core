/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import "./Tooltip.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../utils/Props";
import { MessageType } from "./MessageType";
import { MessageRenderer } from "./MessageRenderer";

/** Properties for [[Tooltip]] component
 * @beta
 */
export interface TooltipProps extends CommonProps {
  value: MessageType;
  percent?: number;
  below?: boolean;
}

/** Tooltip component
 * @beta
 */
export function Tooltip(props: TooltipProps) {
  const style: React.CSSProperties = {
    left: props.percent !== undefined ? `${props.percent}%` : `50%`,
    ...props.style,
  };

  const tooltipClassName = classnames(
    "core-tooltip",
    props.className,
    props.below && "core-tooltip-below",
  );

  return (
    <div className="core-tooltip-container" style={style} >
      <div className={tooltipClassName} data-testid="core-tooltip">
        <MessageRenderer className="core-tooltip-text" message={props.value} useSpan />
      </div>
    </div>
  );
}
