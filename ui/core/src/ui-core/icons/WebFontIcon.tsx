/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Icon
 */

import "./WebFontIcon.scss";
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../utils/Props";

/** Properties for the [[WebFontIcon]] React component
 * @public
 */
export interface WebFontIconProps extends CommonProps {
  /** Bentley Web Font icon name */
  iconName: string;
  /** Click event handler */
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
  /** Text that will be shown when hovered on the icon. */
  title?: string;
  /** Size of the icon */
  iconSize?: "x-small" | "small" | "medium" | "large" | "x-large";
  /** Class name of icon used for custom font-family icons */
  iconClassName?: string;
}

/** WebFontIcon React component
 * @public
 */
export function WebFontIcon(props: WebFontIconProps) {
  const className = classnames(
    props.iconClassName || "bui-webfont-icon",
    props.iconName,
    props.iconSize ? `uicore-icons-${props.iconSize}` : undefined,
    props.className,
  );

  return (
    <span
      className={className}
      title={props.title}
      style={props.style}
      onClick={props.onClick}
      role="presentation"
    />
  );
}
