/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Icon
 */

import * as React from "react";
import { IconSpecUtilities, ConditionalStringValue } from "@bentley/ui-abstract";

import "./IconComponent.scss";

/** Prototype for an IconSpec which can be a string, ReactNode or ConditionalStringValue.
 * @public
 */
export type IconSpec = string | ConditionalStringValue | React.ReactNode;

/** Properties for the [[Icon]] React component
 * @public
 */
export interface IconProps {
  /** CSS class name or Svg(url)/SvgPath for icon */
  iconSpec?: IconSpec;
}

/** Icon Functional component displays an icon based on an [[IconSpec]].
 * @public
 */
export function Icon(props: IconProps) {
  if (!props.iconSpec)
    return null;
  const iconString = (typeof props.iconSpec === "string" || props.iconSpec instanceof ConditionalStringValue) ?
    ConditionalStringValue.getValue(props.iconSpec) : undefined;

  if (iconString) {
    const svgSource = IconSpecUtilities.getSvgSource(iconString);
    // if string begins with "svg:" then we assume it was imported (into source file) using webpack svgr loader
    if (svgSource !== undefined)
      return (
        <img className="core-svg-icon" src={svgSource} />
      );

    const className = "icon " + iconString;
    return (<i className={className} />);
  }

  return (
    <i className="icon core-svg-icon">
      {props.iconSpec}
    </i>
  );
}
