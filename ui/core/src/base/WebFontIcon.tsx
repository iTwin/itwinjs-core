/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as React from "react";
import * as classnames from "classnames";
import "./WebFontIcon.scss";
import "@bentley/icons-webfont/dist/bentley-icons-webfont.css";

/** Props for the WebFontIcon React component */
export interface WebFontIconProps {
  /** Bentley Web Font icon name */
  iconName: string;
  /** CSS class name */
  className?: string;
  /** CSS style properties */
  style?: React.CSSProperties;
  /** Click event handler */
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
}

/** WebFontIcon React component */
export function WebFontIcon(props: WebFontIconProps) {
  const className: string = classnames("bui-webfont-icon", props.iconName, props.className);
  const newProps = Object.assign({}, props, { className });
  delete newProps.iconName;

  return (
    <span {...newProps} />
  );
}
